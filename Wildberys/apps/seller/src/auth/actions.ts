'use server';

import {
  confirmSignIn as confirmSignInWithApi,
  invalidInput,
  requestPasswordResetCode as requestPasswordResetCodeWithApi,
  requestSignInCode,
  resendSignInConfirmation as resendSignInConfirmationWithApi,
  resetPassword as resetPasswordWithApi,
  signInWithCode,
  signInWithPassword as signInWithPasswordWithApi,
  startSignIn as startSignInWithApi,
  type ActionResult,
  type CodeSent,
  type ConfirmationSent,
  type SignInStart,
} from '@bluberi/web-auth/session';

import { toLocale } from '../i18n/paths';
import { authConfig } from './config';

// The language is fixed by the page that renders the form. The rest comes from the browser and is checked.

/** The first step: says whether to ask for a password. Without one a code goes to the email. */
export async function startSignIn(
  locale: string,
  email: unknown,
): Promise<ActionResult<SignInStart>> {
  if (typeof email !== 'string') {
    return invalidInput;
  }

  return startSignInWithApi(authConfig(), email, toLocale(locale));
}

export async function requestCode(locale: string, email: unknown): Promise<ActionResult<CodeSent>> {
  if (typeof email !== 'string') {
    return invalidInput;
  }

  return requestSignInCode(authConfig(), email, toLocale(locale));
}

/** Signs in with a code from the email and saves the session. The form then opens the portal itself. */
export async function signIn(email: unknown, code: unknown): Promise<ActionResult> {
  if (typeof email !== 'string' || typeof code !== 'string') {
    return invalidInput;
  }

  return signInWithCode(authConfig(), email, code);
}

/** Checks the password. A right one sends the code of the second step. */
export async function signInWithPassword(
  email: unknown,
  password: unknown,
): Promise<ActionResult<ConfirmationSent>> {
  if (typeof email !== 'string' || typeof password !== 'string') {
    return invalidInput;
  }

  return signInWithPasswordWithApi(authConfig(), email, password);
}

export async function resendSignInConfirmation(): Promise<ActionResult<CodeSent>> {
  return resendSignInConfirmationWithApi(authConfig());
}

/** Finishes a sign-in with a password and saves the session. */
export async function confirmSignIn(code: unknown): Promise<ActionResult> {
  if (typeof code !== 'string') {
    return invalidInput;
  }

  return confirmSignInWithApi(authConfig(), code);
}

/** A forgotten password starts with a code sent to the email. */
export async function requestPasswordResetCode(
  locale: string,
  email: unknown,
): Promise<ActionResult<CodeSent>> {
  if (typeof email !== 'string') {
    return invalidInput;
  }

  return requestPasswordResetCodeWithApi(authConfig(), email, toLocale(locale));
}

/** A forgotten password ends with the code, a new password, and the person signed in. */
export async function resetPassword(
  email: unknown,
  code: unknown,
  newPassword: unknown,
): Promise<ActionResult> {
  if (typeof email !== 'string' || typeof code !== 'string' || typeof newPassword !== 'string') {
    return invalidInput;
  }

  return resetPasswordWithApi(authConfig(), email, code, newPassword);
}
