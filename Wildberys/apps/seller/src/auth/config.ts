import { createWebAuthConfig, type WebAuthConfig } from '@bluberi/web-auth/config';

/** Paths without the language in front. */
export const signInPath = '/prihlaseni';
export const registrationPath = '/registrace';
export const welcomePath = '/vitejte';
/** Where a seller answers a request of the team for documents. */
export const requestedDocumentsPath = '/doklady';
/** What a seller who was refused or stopped sees in place of the portal. */
export const reviewOutcomePath = '/stav';
export const signOutPath = '/odhlaseni';
export const homePath = '/prehled';
export const securityPath = '/zabezpeceni';
/** The stream of live events of the API, which the open pages of a seller listen to. */
export const liveEventsPath = '/udalosti';

let config: WebAuthConfig | undefined;

/** Read on the first request, not when the app is built: the build has no settings. */
export function authConfig(): WebAuthConfig {
  config ??= createWebAuthConfig('seller');

  return config;
}
