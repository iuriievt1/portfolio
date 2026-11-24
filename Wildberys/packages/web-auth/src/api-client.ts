import { createClient, createConfig, type Client } from '@bluberi/api-client/client';

import type { WebAuthConfig } from './config';

/** A client for one request to the API. With an access token it acts as the signed-in user. */
export function createApiClient(config: WebAuthConfig, accessToken?: string): Client {
  return createClient(createConfig({ baseUrl: config.apiUrl, auth: accessToken }));
}
