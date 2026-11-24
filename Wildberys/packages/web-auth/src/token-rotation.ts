import { authRefresh } from '@bluberi/api-client';

import { createApiClient } from './api-client';
import type { WebAuthConfig } from './config';
import type { SessionTokens } from './tokens';

/** How long the result of an exchange is kept for requests that still carry the old refresh token. */
const keepExchangeMilliseconds = 60_000;

const exchanges = new Map<string, Promise<SessionTokens | undefined>>();

async function exchange(
  config: WebAuthConfig,
  refreshToken: string,
): Promise<SessionTokens | undefined> {
  const { data, response } = await authRefresh({
    client: createApiClient(config),
    body: { refreshToken },
  });

  if (data) {
    return { accessToken: data.accessToken, refreshToken: data.refreshToken };
  }

  // The API said no: the session has ended or the account is blocked.
  if (response?.status === 401 || response?.status === 403) {
    return undefined;
  }

  // Anything else is a failure of the API, not of the session. The user stays signed in.
  throw new Error('The API did not exchange the refresh token');
}

/**
 * Exchanges a refresh token for a new pair of tokens. Undefined means the session has ended.
 *
 * A refresh token works once, and using a replaced one ends the session. A browser sends several
 * requests at the same moment, all with the same token, so they must share one exchange:
 * the first request starts it, the others get its result, also when they arrive a little later.
 */
export function rotateTokens(
  config: WebAuthConfig,
  refreshToken: string,
): Promise<SessionTokens | undefined> {
  const known = exchanges.get(refreshToken);

  if (known) {
    return known;
  }

  const started = exchange(config, refreshToken);

  exchanges.set(refreshToken, started);
  started.then(
    () => {
      setTimeout(() => exchanges.delete(refreshToken), keepExchangeMilliseconds).unref();
    },
    // A failed exchange is not kept: the next request tries again.
    () => exchanges.delete(refreshToken),
  );

  return started;
}
