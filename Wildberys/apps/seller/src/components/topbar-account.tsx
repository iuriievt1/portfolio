import { UserBadge } from '@bluberi/ui/components/user-badge';
import { displayName, getSessionId } from '@bluberi/web-auth/session';
import Link from 'next/link';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { authConfig, securityPath, signOutPath } from '../auth/config';
import { getUser } from '../auth/current-user';
import { openSecuritySettings, remindAboutSecurityLater } from '../auth/security-actions';
import { isSecurityReminderPutOff } from '../auth/security-reminder';
import { localizedPath } from '../i18n/paths';
import { SecurityReminder } from './security-reminder';

/**
 * The signed-in person in the top bar. Their name opens the security settings.
 * Until the account is secured, a reminder stands next to the name.
 */
export async function TopbarAccount() {
  const locale = await getLocale();
  const user = await getUser();

  if (!user) {
    // The cookies are still there but the session has ended. The sign-out route removes them.
    redirect(localizedPath(signOutPath, locale));
  }

  const t = await getTranslations('shell');
  const messages = await getMessages();
  const settingsHref = localizedPath(securityPath, locale);
  const secured = user.hasPassword && user.phoneVerified;

  return (
    <>
      {secured ? null : (
        <SecurityReminder
          // A new sign-in starts the reminder anew, also when Next.js kept the page from the last one.
          key={await getSessionId(authConfig())}
          labels={messages.security.reminder}
          settingsHref={settingsHref}
          settingsSegment={securityPath.slice(1)}
          open={!(await isSecurityReminderPutOff())}
          onContinue={openSecuritySettings.bind(null, locale)}
          onLater={remindAboutSecurityLater}
        />
      )}
      <Link
        href={settingsHref}
        title={t('account')}
        className="-mx-2 flex min-w-0 rounded-sm px-2 py-1.5 transition-colors outline-none hover:bg-gray-100 focus-visible:ring-4 focus-visible:ring-berry-500/14"
      >
        <UserBadge tone="light" name={displayName(user)} />
      </Link>
    </>
  );
}

/** Holds the place of the person in the top bar while the session is read. */
export function TopbarAccountPlaceholder() {
  return (
    <div aria-hidden className="flex items-center gap-2.5">
      <span className="size-7.5 rounded-full bg-gray-100" />
      <span className="h-3 w-32 rounded-full bg-gray-100" />
    </div>
  );
}
