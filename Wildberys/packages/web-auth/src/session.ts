import {
  authConfirmSignIn,
  authCurrentUser,
  authRequestEmailCode,
  authRequestPasswordResetCode,
  authResendSignInConfirmation,
  authSetPassword,
  authSignInWithCode,
  authSignInWithPassword,
  authSignOut,
  authStartSignIn,
  type CurrentUser,
  type Locale,
  type SignInConfirmationChannel,
} from '@bluberi/api-client';
import { cookies } from 'next/headers';

import { done, failure, invalidInput, succeeded, type ActionResult } from './action-result';
import { createApiClient } from './api-client';
import type { WebAuthConfig } from './config';
import {
  clearSession,
  clearSignInConfirmation,
  readSession,
  readSignInConfirmation,
  writeSession,
  writeSignInConfirmation,
} from './session-cookies';
import { accessTokenSessionId } from './tokens';

export { invalidInput, type ActionResult } from './action-result';

/** The API sends sign-in codes of this many digits. */
export const signInCodeLength = 6;

/** The API takes passwords of at least this many characters. */
export const passwordMinLength = 10;

/** The password step was too long ago: the same code the API answers with. */
const confirmationExpired = { ok: false, code: 'SIGN_IN_CONFIRMATION_EXPIRED' } as const;

/** How to call a person on the screen: the name when we know it, the email otherwise. */
export function displayName(user: Pick<CurrentUser, 'firstName' | 'lastName' | 'email'>): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');

  return name || user.email;
}

/** How long a code that was just sent works and how long to wait before asking for another one. */
export interface CodeSent {
  readonly resendInSeconds: number;
  readonly expiresInSeconds: number;
}

/** What a sign-in asks for after the email: the password of the account, or the code that was just sent. */
export type SignInStart =
  { readonly step: 'PASSWORD' } | { readonly step: 'EMAIL_CODE'; readonly sent: CodeSent };

/** The code of the second step of a sign-in with a password, and where it went. */
export interface ConfirmationSent extends CodeSent {
  readonly channel: SignInConfirmationChannel;
  /** The last digits of the phone number when the code went by SMS. */
  readonly phoneEnding: string | null;
}

/** The first step of a sign-in. An account without a password, or a new email, gets a code at once. */
export async function startSignIn(
  config: WebAuthConfig,
  email: string,
  locale: Locale,
): Promise<ActionResult<SignInStart>> {
  const { data, error } = await authStartSignIn({
    client: createApiClient(config),
    body: { email, locale, app: config.app },
  });

  if (!data) {
    return failure(error);
  }

  return {
    ok: true,
    value: data.code ? { step: 'EMAIL_CODE', sent: data.code } : { step: 'PASSWORD' },
  };
}

/** Sends a sign-in code to the email. */
export async function requestSignInCode(
  config: WebAuthConfig,
  email: string,
  locale: Locale,
): Promise<ActionResult<CodeSent>> {
  const { data, error } = await authRequestEmailCode({
    client: createApiClient(config),
    body: { email, locale, app: config.app },
  });

  return data ? { ok: true, value: data } : failure(error);
}

/** Sends a code for a forgotten password to the email. It goes into resetPassword with the new password. */
export async function requestPasswordResetCode(
  config: WebAuthConfig,
  email: string,
  locale: Locale,
): Promise<ActionResult<CodeSent>> {
  const { data, error } = await authRequestPasswordResetCode({
    client: createApiClient(config),
    body: { email, locale },
  });

  return data ? { ok: true, value: data } : failure(error);
}

/** Signs in with the code from the email and saves the session in cookies. Call it from a server action. */
export async function signInWithCode(
  config: WebAuthConfig,
  email: string,
  code: string,
): Promise<ActionResult> {
  const { data, error } = await authSignInWithCode({
    client: createApiClient(config),
    body: { email, code },
  });

  if (!data) {
    return failure(error);
  }

  writeSession(await cookies(), config, data);

  return done;
}

/**
 * The first of the two steps of a sign-in with a password. A right password sends a code.
 * The proof that the password was right stays in a cookie until the code is entered.
 * Call it from a server action.
 */
export async function signInWithPassword(
  config: WebAuthConfig,
  email: string,
  password: string,
): Promise<ActionResult<ConfirmationSent>> {
  const { data, error } = await authSignInWithPassword({
    client: createApiClient(config),
    body: { email, password, app: config.app },
  });

  if (!data) {
    return failure(error);
  }

  writeSignInConfirmation(await cookies(), config, data.confirmationToken, data.expiresInSeconds);

  // The token stays on the server side: the browser gets only what the form shows.
  return {
    ok: true,
    value: {
      resendInSeconds: data.resendInSeconds,
      expiresInSeconds: data.expiresInSeconds,
      channel: data.channel,
      phoneEnding: data.phoneEnding,
    },
  };
}

/** Sends the code of the second step again. */
export async function resendSignInConfirmation(
  config: WebAuthConfig,
): Promise<ActionResult<CodeSent>> {
  const confirmationToken = readSignInConfirmation(await cookies(), config);

  if (!confirmationToken) {
    return confirmationExpired;
  }

  const { data, error } = await authResendSignInConfirmation({
    client: createApiClient(config),
    body: { confirmationToken },
  });

  return data ? { ok: true, value: data } : failure(error);
}

/** The second step of a sign-in with a password: the code. Saves the session in cookies. Call it from a server action. */
export async function confirmSignIn(config: WebAuthConfig, code: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  const confirmationToken = readSignInConfirmation(cookieStore, config);

  if (!confirmationToken) {
    return confirmationExpired;
  }

  const { data, error } = await authConfirmSignIn({
    client: createApiClient(config),
    body: { confirmationToken, code },
  });

  if (!data) {
    return failure(error);
  }

  clearSignInConfirmation(cookieStore, config);
  writeSession(cookieStore, config, data);

  return done;
}

/**
 * A forgotten password: signs in with the code from the email and sets a new password at once.
 * Nobody is signed in when the password cannot be saved. Call it from a server action.
 */
export async function resetPassword(
  config: WebAuthConfig,
  email: string,
  code: string,
  newPassword: string,
): Promise<ActionResult> {
  // Checked first, so a password the API would refuse does not use up the code.
  if (newPassword.length < passwordMinLength) {
    return invalidInput;
  }

  const { data: tokens, error } = await authSignInWithCode({
    client: createApiClient(config),
    body: { email, code },
  });

  if (!tokens) {
    return failure(error);
  }

  const asUser = createApiClient(config, tokens.accessToken);
  const saved = await authSetPassword({ client: asUser, body: { newPassword } });

  if (!succeeded(saved)) {
    await authSignOut({ client: asUser });

    return failure(saved.error);
  }

  writeSession(await cookies(), config, tokens);

  return done;
}

/** Ends the session in the API and removes its cookies. Call it from a server action or a route handler. */
export async function signOut(config: WebAuthConfig): Promise<void> {
  const cookieStore = await cookies();
  const { accessToken } = readSession(cookieStore, config);

  if (accessToken) {
    // The cookies go away whatever the API answers: an ended session answers 401 here.
    await authSignOut({ client: createApiClient(config, accessToken) });
  }

  clearSession(cookieStore, config);
}

/**
 * Answers the sign-out button, which posts a plain form to a route of the app.
 * The browser then loads the sign-in page in full, so nothing of the signed-in app
 * stays in its memory. A post that another site sent is refused.
 */
export async function signOutFromForm(
  config: WebAuthConfig,
  request: Request,
  signInPath: string,
): Promise<Response> {
  // Browsers set this header themselves, a page cannot fake it.
  if (request.headers.get('sec-fetch-site') !== 'same-origin') {
    return new Response(null, { status: 403 });
  }

  await signOut(config);

  // 303 tells the browser to open the sign-in page with a GET.
  return new Response(null, { status: 303, headers: { location: signInPath } });
}

/** The signed-in user with their roles. Undefined when nobody is signed in or the session has ended. */
export async function getCurrentUser(config: WebAuthConfig): Promise<CurrentUser | undefined> {
  const { accessToken } = readSession(await cookies(), config);

  if (!accessToken) {
    return undefined;
  }

  const { data, response } = await authCurrentUser({
    client: createApiClient(config, accessToken),
  });

  if (data) {
    return data;
  }

  if (response?.status === 401 || response?.status === 403) {
    return undefined;
  }

  throw new Error('The API did not return the current user');
}

/** The session of this browser. It is the same from the sign-in to the sign-out. */
export async function getSessionId(config: WebAuthConfig): Promise<string | undefined> {
  const { accessToken } = readSession(await cookies(), config);

  return accessToken ? accessTokenSessionId(accessToken) : undefined;
}
