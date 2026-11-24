'use server';

import {
  invalidInput,
  requestSignInCode,
  signInWithCode,
  type ActionResult,
  type CodeSent,
} from '@bluberi/web-auth/session';

import { authConfig, emailLocale } from './config';

// What comes from the browser is checked before it is used.

export async function requestCode(email: unknown): Promise<ActionResult<CodeSent>> {
  if (typeof email !== 'string') {
    return invalidInput;
  }

  return requestSignInCode(authConfig(), email, emailLocale);
}

/** Signs in and saves the session. The form then opens the admin itself. */
export async function signIn(email: unknown, code: unknown): Promise<ActionResult> {
  if (typeof email !== 'string' || typeof code !== 'string') {
    return invalidInput;
  }

  return signInWithCode(authConfig(), email, code);
}
