'use server';

import { withoutSeparators } from '@bluberi/web-auth/phone';
import {
  confirmPhone,
  requestPhoneCode,
  setPassword,
  setSignInConfirmationChannel,
} from '@bluberi/web-auth/security';
import { invalidInput, type ActionResult, type CodeSent } from '@bluberi/web-auth/session';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';

import { localizedPath } from '../i18n/paths';
import { authConfig, securityPath } from './config';
import { putOffSecurityReminder } from './security-reminder';

// What comes from the browser is checked before it is used.

/** After a change the page is drawn again, so the tracker and the top bar show the new state. */
function shown<Result extends ActionResult<unknown>>(result: Result): Result {
  if (result.ok) {
    refresh();
  }

  return result;
}

/** Sets the first password or changes it. Changing needs the current one. */
export async function savePassword(
  newPassword: unknown,
  currentPassword: unknown,
): Promise<ActionResult> {
  if (
    typeof newPassword !== 'string' ||
    (currentPassword !== undefined && typeof currentPassword !== 'string')
  ) {
    return invalidInput;
  }

  return shown(await setPassword(authConfig(), newPassword, currentPassword));
}

export async function sendPhoneCode(phone: unknown): Promise<ActionResult<CodeSent>> {
  if (typeof phone !== 'string') {
    return invalidInput;
  }

  return requestPhoneCode(authConfig(), withoutSeparators(phone));
}

export async function confirmPhoneNumber(phone: unknown, code: unknown): Promise<ActionResult> {
  if (typeof phone !== 'string' || typeof code !== 'string') {
    return invalidInput;
  }

  return shown(await confirmPhone(authConfig(), withoutSeparators(phone), code));
}

/** Chooses where the code of the second step of a sign-in goes. */
export async function chooseSignInConfirmationChannel(channel: unknown): Promise<ActionResult> {
  if (channel !== 'EMAIL' && channel !== 'SMS') {
    return invalidInput;
  }

  return shown(await setSignInConfirmationChannel(authConfig(), channel));
}

/** "Later" on the reminder to secure the account. It comes back at the next sign-in. */
export async function remindAboutSecurityLater(): Promise<void> {
  await putOffSecurityReminder();
}

/** "Continue" on the reminder: it has done its job, the page with the settings opens. */
export async function openSecuritySettings(locale: string): Promise<void> {
  await putOffSecurityReminder();
  redirect(localizedPath(securityPath, locale));
}
