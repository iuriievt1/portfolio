import type { WebAuthConfig } from './config';
import type { SessionTokens } from './tokens';

/** The same as the lifetime of a session in the API: 30 days without use. */
const sessionLifetimeSeconds = 30 * 24 * 60 * 60;

interface CookieToSet {
  readonly name: string;
  readonly value: string;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: 'lax';
  readonly path: string;
  readonly maxAge: number;
}

/** What the cookies of a request, of a response and of next/headers have in common. */
export interface CookieStore {
  get(name: string): { readonly value: string } | undefined;
  set(cookie: CookieToSet): unknown;
  delete(name: string): unknown;
}

/** A cookie that scripts in the browser cannot read. */
function protectedCookie(
  config: WebAuthConfig,
  name: string,
  value: string,
  maxAge: number,
): CookieToSet {
  return {
    name,
    value,
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

export function sessionCookieNames(config: WebAuthConfig): { access: string; refresh: string } {
  return {
    access: `bluberi_${config.app}_access`,
    refresh: `bluberi_${config.app}_refresh`,
  };
}

export function readSession(store: CookieStore, config: WebAuthConfig): Partial<SessionTokens> {
  const names = sessionCookieNames(config);

  return {
    accessToken: store.get(names.access)?.value,
    refreshToken: store.get(names.refresh)?.value,
  };
}

/** Saves the tokens in cookies that scripts in the browser cannot read. */
export function writeSession(
  store: CookieStore,
  config: WebAuthConfig,
  tokens: SessionTokens,
): void {
  const names = sessionCookieNames(config);

  store.set(protectedCookie(config, names.access, tokens.accessToken, sessionLifetimeSeconds));
  store.set(protectedCookie(config, names.refresh, tokens.refreshToken, sessionLifetimeSeconds));
}

export function clearSession(store: CookieStore, config: WebAuthConfig): void {
  const names = sessionCookieNames(config);

  store.delete(names.access);
  store.delete(names.refresh);
}

function signInConfirmationCookieName(config: WebAuthConfig): string {
  return `bluberi_${config.app}_sign_in_confirmation`;
}

/** The token a right password gave, kept until the sign-in is finished with a code. */
export function readSignInConfirmation(
  store: CookieStore,
  config: WebAuthConfig,
): string | undefined {
  return store.get(signInConfirmationCookieName(config))?.value;
}

export function writeSignInConfirmation(
  store: CookieStore,
  config: WebAuthConfig,
  confirmationToken: string,
  lifetimeSeconds: number,
): void {
  store.set(
    protectedCookie(
      config,
      signInConfirmationCookieName(config),
      confirmationToken,
      lifetimeSeconds,
    ),
  );
}

export function clearSignInConfirmation(store: CookieStore, config: WebAuthConfig): void {
  store.delete(signInConfirmationCookieName(config));
}
