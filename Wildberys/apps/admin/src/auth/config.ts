import { createWebAuthConfig, type WebAuthConfig } from '@bluberi/web-auth/config';

export const signInPath = '/sign-in';
export const signOutPath = '/sign-out';
export const homePath = '/overview';
/** The stream of live events of the API, which the open pages of the admin listen to. */
export const liveEventsPath = '/events';

/** The admin is in Russian, but the API writes emails only in Czech and English. */
export const emailLocale = 'en';

let config: WebAuthConfig | undefined;

/** Read on the first request, not when the app is built: the build has no settings. */
export function authConfig(): WebAuthConfig {
  config ??= createWebAuthConfig('admin');

  return config;
}
