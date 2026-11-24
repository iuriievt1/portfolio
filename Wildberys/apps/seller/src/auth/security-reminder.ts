import { getSessionId } from '@bluberi/web-auth/session';
import { cookies } from 'next/headers';

import { authConfig } from './config';

/**
 * The reminder to secure the account is put off with "Later" until the next sign-in.
 * The cookie keeps the session it was put off in, so a new sign-in shows the reminder again.
 * It has no lifetime of its own: it goes away when the browser is closed.
 */
const cookieName = 'bluberi_seller_security_reminder_put_off';

export async function isSecurityReminderPutOff(): Promise<boolean> {
  const putOffIn = (await cookies()).get(cookieName)?.value;

  return putOffIn !== undefined && putOffIn === (await getSessionId(authConfig()));
}

/** Call it from a server action. */
export async function putOffSecurityReminder(): Promise<void> {
  const config = authConfig();
  const sessionId = await getSessionId(config);

  if (sessionId) {
    (await cookies()).set({
      name: cookieName,
      value: sessionId,
      httpOnly: true,
      secure: config.secureCookies,
      sameSite: 'lax',
      path: '/',
    });
  }
}
