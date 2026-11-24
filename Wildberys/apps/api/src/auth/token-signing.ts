import type { AppConfig } from '../config/app-config.js';

/** What every token the API signs has in common. */
export const tokenAlgorithm = 'HS256';
export const tokenIssuer = 'bluberi-api';

export function tokenKey(config: AppConfig): Uint8Array {
  return new TextEncoder().encode(config.accessTokenSecret);
}
