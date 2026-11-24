import type { Client } from '@bluberi/api-client/client';
import type { NextRequest, NextResponse } from 'next/server';

import { createApiClient } from './api-client';
import type { WebAuthConfig } from './config';
import { clearSession, readSession, writeSession } from './session-cookies';
import { rotateTokens } from './token-rotation';
import { accessTokenExpiry } from './tokens';

/** An access token with less time left than this is replaced before the request goes on. */
const renewWhenLeftMilliseconds = 60_000;

export interface RequestSession {
  readonly signedIn: boolean;
  /** Puts new or removed session cookies on the response that goes back to the browser. */
  applyTo(response: NextResponse): NextResponse;
}

/**
 * Runs in the proxy of an app, before every request. It is the only place where tokens are renewed.
 *
 * When the access token is about to expire, it is exchanged here and the new cookies are put
 * on the request itself, so pages and server actions behind the proxy always read a working token.
 * Call applyTo on the response to send the same cookies to the browser.
 */
export async function resolveSession(
  request: NextRequest,
  config: WebAuthConfig,
  now = Date.now(),
): Promise<RequestSession> {
  const { accessToken, refreshToken } = readSession(request.cookies, config);

  if (!refreshToken) {
    clearSession(request.cookies, config);

    return {
      signedIn: false,
      applyTo: (response) => {
        if (accessToken) {
          clearSession(response.cookies, config);
        }

        return response;
      },
    };
  }

  const expiry = accessToken ? accessTokenExpiry(accessToken) : undefined;

  if (expiry !== undefined && expiry - now > renewWhenLeftMilliseconds) {
    return { signedIn: true, applyTo: (response) => response };
  }

  const tokens = await rotateTokens(config, refreshToken);

  if (!tokens) {
    clearSession(request.cookies, config);

    return {
      signedIn: false,
      applyTo: (response) => {
        clearSession(response.cookies, config);

        return response;
      },
    };
  }

  writeSession(request.cookies, config, tokens);

  return {
    signedIn: true,
    applyTo: (response) => {
      writeSession(response.cookies, config, tokens);

      return response;
    },
  };
}

/**
 * A client that calls the API as the person of this request. Undefined when nobody is signed in.
 * For the proxy of an app, after resolveSession: it reads the token that function put on the request.
 */
export function requestApiClient(request: NextRequest, config: WebAuthConfig): Client | undefined {
  const { accessToken } = readSession(request.cookies, config);

  return accessToken ? createApiClient(config, accessToken) : undefined;
}
