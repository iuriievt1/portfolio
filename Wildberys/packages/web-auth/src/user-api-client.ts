import type { Client } from '@bluberi/api-client/client';
import { cookies } from 'next/headers';

import { createApiClient } from './api-client';
import type { WebAuthConfig } from './config';
import { readSession } from './session-cookies';

/**
 * A client that calls the API as the signed-in person. Undefined when nobody is signed in.
 * For server components, server actions and route handlers.
 */
export async function userApiClient(config: WebAuthConfig): Promise<Client | undefined> {
  const { accessToken } = readSession(await cookies(), config);

  return accessToken ? createApiClient(config, accessToken) : undefined;
}
