import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WebAuthConfig } from './config';
import { relayLiveEvents } from './live-events';

const config: WebAuthConfig = {
  app: 'seller',
  apiUrl: 'http://api.test',
  secureCookies: false,
};
const stream = {
  url: '/v1/sellers/{sellerId}/conversations/events',
  path: { sellerId: 'seller-1' },
};

/** The cookies of the request, as next/headers gives them to a route handler. */
const cookieJar = vi.hoisted(() => ({ values: new Map<string, string>() }));

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const value = cookieJar.values.get(name);

        return value === undefined ? undefined : { value };
      },
    }),
}));

/** The API as the route sees it: remembers what it was asked and answers it. */
function mockApi(answer: () => Response | Promise<Response>): { asked: () => Request[] } {
  const asked: Request[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((address: string, init: RequestInit) => {
      asked.push(new Request(address, init));

      return Promise.resolve(answer());
    }),
  );

  return { asked: () => asked };
}

function signIn(): void {
  cookieJar.values.set('bluberi_seller_access', 'the-access-token');
}

describe('relayLiveEvents', () => {
  afterEach(() => {
    cookieJar.values.clear();
    vi.unstubAllGlobals();
  });

  it('answers 401 and does not ask the API when nobody is signed in', async () => {
    const api = mockApi(() => new Response('never'));
    const response = await relayLiveEvents(config, stream, new AbortController().signal);

    expect(response.status).toBe(401);
    expect(api.asked()).toHaveLength(0);
  });

  it('asks the API for the stream as the signed-in person and passes it on as it is', async () => {
    signIn();

    const api = mockApi(
      () =>
        new Response('event: ready\ndata: {}\n\n', {
          headers: { 'content-type': 'text/event-stream' },
        }),
    );
    const response = await relayLiveEvents(config, stream, new AbortController().signal);
    const [request] = api.asked();

    expect(request?.url).toBe('http://api.test/v1/sellers/seller-1/conversations/events');
    expect(request?.headers.get('authorization')).toBe('Bearer the-access-token');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    // Nothing between the app and the browser may keep the stream or squeeze it.
    expect(response.headers.get('cache-control')).toBe('no-store, no-transform');
    expect(await response.text()).toBe('event: ready\ndata: {}\n\n');
  });

  it('closes the stream to the API when the page goes away', async () => {
    signIn();

    const api = mockApi(() => new Response('event: ready\ndata: {}\n\n'));
    const page = new AbortController();

    await relayLiveEvents(config, stream, page.signal);
    page.abort();

    expect(api.asked()[0]?.signal.aborted).toBe(true);
  });

  it.each([403, 404])('passes on that the API refused with %i', async (status) => {
    signIn();
    mockApi(() => Response.json({ code: 'REFUSED' }, { status }));

    const response = await relayLiveEvents(config, stream, new AbortController().signal);

    expect(response.status).toBe(status);
    expect(await response.text()).toBe('');
  });

  it('answers 502 when the API cannot be reached', async () => {
    signIn();
    mockApi(() => Promise.reject(new Error('connect ECONNREFUSED')));

    const response = await relayLiveEvents(config, stream, new AbortController().signal);

    expect(response.status).toBe(502);
  });
});
