import type { SignInApp } from '@bluberi/api-client';

export interface WebAuthConfig {
  /**
   * Which Bluberi app this is. It is part of the cookie names, so two apps on one host keep
   * separate sessions, and the API names it in the email with a sign-in code.
   */
  readonly app: SignInApp;
  /** Address of the API. The apps call it from their server side only. */
  readonly apiUrl: string;
  /** Send the session cookies over HTTPS only. Off in local development on http://localhost. */
  readonly secureCookies: boolean;
}

/** Reads the settings a Bluberi web app needs to sign users in. Stops with a clear message when one is missing. */
export function createWebAuthConfig(
  app: SignInApp,
  env: NodeJS.ProcessEnv = process.env,
): WebAuthConfig {
  const apiUrl = env.API_URL;

  if (!apiUrl) {
    throw new Error(`API_URL is not set. Copy apps/${app}/.env.example to apps/${app}/.env`);
  }

  return { app, apiUrl, secureCookies: env.NODE_ENV === 'production' };
}
