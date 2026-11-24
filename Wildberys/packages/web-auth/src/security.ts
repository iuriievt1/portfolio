import {
  authConfirmPhone,
  authRequestPhoneCode,
  authSetPassword,
  authSetSignInConfirmationChannel,
  type SignInConfirmationChannel,
} from '@bluberi/api-client';

import { done, failure, succeeded, type ActionResult } from './action-result';
import type { WebAuthConfig } from './config';
import type { CodeSent } from './session';
import { userApiClient } from './user-api-client';

/**
 * How a signed-in person protects their account: the password, the phone number and where
 * the code of the second step of a sign-in goes. Call these from server actions.
 */

/** The same code the API answers with when nobody is signed in. */
const unauthenticated = { ok: false, code: 'UNAUTHENTICATED' } as const;

/**
 * Sets or changes the password. The current password is not needed for the first password
 * right after a sign-in with a code.
 */
export async function setPassword(
  config: WebAuthConfig,
  newPassword: string,
  currentPassword?: string,
): Promise<ActionResult> {
  const client = await userApiClient(config);

  if (!client) {
    return unauthenticated;
  }

  const saved = await authSetPassword({ client, body: { newPassword, currentPassword } });

  return succeeded(saved) ? done : failure(saved.error);
}

/** Sends a code by SMS to a phone number the person wants to confirm. */
export async function requestPhoneCode(
  config: WebAuthConfig,
  phone: string,
): Promise<ActionResult<CodeSent>> {
  const client = await userApiClient(config);

  if (!client) {
    return unauthenticated;
  }

  const { data, error } = await authRequestPhoneCode({ client, body: { phone } });

  return data ? { ok: true, value: data } : failure(error);
}

/** Saves the phone number after the person entered the code from the SMS. */
export async function confirmPhone(
  config: WebAuthConfig,
  phone: string,
  code: string,
): Promise<ActionResult> {
  const client = await userApiClient(config);

  if (!client) {
    return unauthenticated;
  }

  const saved = await authConfirmPhone({ client, body: { phone, code } });

  return succeeded(saved) ? done : failure(saved.error);
}

/** Chooses where the code of the second step of a sign-in goes. */
export async function setSignInConfirmationChannel(
  config: WebAuthConfig,
  channel: SignInConfirmationChannel,
): Promise<ActionResult> {
  const client = await userApiClient(config);

  if (!client) {
    return unauthenticated;
  }

  const saved = await authSetSignInConfirmationChannel({ client, body: { channel } });

  return succeeded(saved) ? done : failure(saved.error);
}
