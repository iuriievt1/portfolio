import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WebAuthConfig } from './config';
import { resolveSession } from './proxy';

const config: WebAuthConfig = {
  app: 'seller',
  apiUrl: 'http://api.test',
  secureCookies: false,
};
const now = Date.parse('2026-11-12T12:00:00Z');
const minute = 60_000;

function accessToken(expiresAt: number): string {
  const claims = Buffer.from(JSON.stringify({ exp: Math.floor(expiresAt / 1000) })).toString(
    'base64url',
  );

  return `header.${claims}.signature`;
}

function requestWith(cookies: Record<string, string>): NextRequest {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

  return new NextRequest('http://localhost:3001/prehled', { headers: { cookie } });
}

/** The API as the proxy sees it: counts the exchanges and answers them. */
function mockApi(answer: () => Response): { calls: () => number; bodies: unknown[] } {
  const bodies: unknown[] = [];
  const fetchMock = vi.fn(async (request: Request) => {
    bodies.push(await request.json());

    return answer();
  });

  vi.stubGlobal('fetch', fetchMock);

  return { calls: () => fetchMock.mock.calls.length, bodies };
}

function newTokens(access: string, refresh: string): Response {
  return Response.json({ accessToken: access, refreshToken: refresh, expiresInSeconds: 900 });
}

describe('resolveSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('says nobody is signed in when there are no cookies', async () => {
    const api = mockApi(() => new Response(null, { status: 500 }));
    const session = await resolveSession(requestWith({}), config, now);
    const response = session.applyTo(NextResponse.next());

    expect(session.signedIn).toBe(false);
    expect(response.cookies.getAll()).toEqual([]);
    expect(api.calls()).toBe(0);
  });

  it('lets a request with a fresh access token through without calling the API', async () => {
    const api = mockApi(() => new Response(null, { status: 500 }));
    const session = await resolveSession(
      requestWith({
        bluberi_seller_access: accessToken(now + 10 * minute),
        bluberi_seller_refresh: 'refresh-fresh',
      }),
      config,
      now,
    );

    expect(session.signedIn).toBe(true);
    expect(session.applyTo(NextResponse.next()).cookies.getAll()).toEqual([]);
    expect(api.calls()).toBe(0);
  });

  it.each([
    ['is about to expire', accessToken(now + 30_000)],
    ['has expired', accessToken(now - minute)],
    ['cannot be read', 'broken'],
  ])('renews the tokens when the access token %s', async (_name, access) => {
    const renewed = accessToken(now + 15 * minute);
    const api = mockApi(() => newTokens(renewed, 'refresh-2'));
    const request = requestWith({
      bluberi_seller_access: access,
      bluberi_seller_refresh: `refresh-1-${_name}`,
    });
    const session = await resolveSession(request, config, now);
    const response = session.applyTo(NextResponse.next());

    expect(session.signedIn).toBe(true);
    expect(api.bodies).toEqual([{ refreshToken: `refresh-1-${_name}` }]);
    // The page behind the proxy reads the new tokens from the request.
    expect(request.cookies.get('bluberi_seller_access')?.value).toBe(renewed);
    expect(request.cookies.get('bluberi_seller_refresh')?.value).toBe('refresh-2');
    // The browser gets them as cookies that scripts cannot read.
    expect(response.cookies.get('bluberi_seller_access')).toMatchObject({
      value: renewed,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    expect(response.cookies.get('bluberi_seller_refresh')).toMatchObject({
      value: 'refresh-2',
      httpOnly: true,
    });
  });

  it('renews the tokens when only the refresh cookie is left', async () => {
    const api = mockApi(() => newTokens(accessToken(now + 15 * minute), 'refresh-2'));
    const session = await resolveSession(
      requestWith({ bluberi_seller_refresh: 'refresh-only' }),
      config,
      now,
    );

    expect(session.signedIn).toBe(true);
    expect(api.calls()).toBe(1);
  });

  it('exchanges a refresh token once for requests that arrive together or a little later', async () => {
    const api = mockApi(() => newTokens(accessToken(now + 15 * minute), 'refresh-2'));
    const cookies = {
      bluberi_seller_access: accessToken(now - minute),
      bluberi_seller_refresh: 'refresh-shared',
    };
    const [first, second] = await Promise.all([
      resolveSession(requestWith(cookies), config, now),
      resolveSession(requestWith(cookies), config, now),
    ]);

    vi.advanceTimersByTime(30_000);

    const late = await resolveSession(requestWith(cookies), config, now);

    expect([first.signedIn, second.signedIn, late.signedIn]).toEqual([true, true, true]);
    expect(api.calls()).toBe(1);
  });

  it('removes the cookies when the API says the session has ended', async () => {
    mockApi(() => Response.json({ code: 'INVALID_REFRESH_TOKEN' }, { status: 401 }));

    const request = requestWith({
      bluberi_seller_access: accessToken(now - minute),
      bluberi_seller_refresh: 'refresh-ended',
    });
    const session = await resolveSession(request, config, now);
    const response = session.applyTo(NextResponse.next());

    expect(session.signedIn).toBe(false);
    expect(request.cookies.has('bluberi_seller_refresh')).toBe(false);
    expect(response.cookies.get('bluberi_seller_access')?.value).toBe('');
    expect(response.cookies.get('bluberi_seller_refresh')?.value).toBe('');
  });

  it('keeps the session and fails loudly when the API is down, then tries again', async () => {
    mockApi(() => new Response(null, { status: 503 }));

    const cookies = {
      bluberi_seller_access: accessToken(now - minute),
      bluberi_seller_refresh: 'refresh-api-down',
    };

    await expect(resolveSession(requestWith(cookies), config, now)).rejects.toThrow(
      'The API did not exchange the refresh token',
    );

    const api = mockApi(() => newTokens(accessToken(now + 15 * minute), 'refresh-2'));
    const session = await resolveSession(requestWith(cookies), config, now);

    expect(session.signedIn).toBe(true);
    expect(api.calls()).toBe(1);
  });

  it('keeps the sessions of two apps on one host apart', async () => {
    const api = mockApi(() => new Response(null, { status: 500 }));
    const session = await resolveSession(
      requestWith({
        bluberi_admin_access: accessToken(now + 10 * minute),
        bluberi_admin_refresh: 'refresh-of-admin',
      }),
      config,
      now,
    );

    expect(session.signedIn).toBe(false);
    expect(api.calls()).toBe(0);
  });
});
