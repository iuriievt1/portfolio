import { LiveRefresh } from '@bluberi/ui/components/live-refresh';
import { Logo } from '@bluberi/ui/components/logo';
import { SignOutButton } from '@bluberi/ui/components/sign-out-button';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { liveEventsPath, signOutPath } from '../auth/config';
import { localizedPath } from '../i18n/paths';

interface PlainPageProps {
  readonly locale: string;
  /** Centered in the column, for a page that says one thing. */
  readonly centered?: boolean;
  readonly children: ReactNode;
}

/**
 * A page of the portal without its menu: the logo, the way out and one narrow column.
 * For the few things a seller does outside the sections, on a phone as easily as on a computer.
 * It is for a person who has a seller, and shows at once what the team decides about it.
 */
export async function PlainPage({ locale, centered = false, children }: PlainPageProps) {
  const t = await getTranslations('shell');

  return (
    <main className="flex min-h-screen flex-col bg-soft px-6 py-7 sm:px-10">
      <LiveRefresh url={localizedPath(liveEventsPath, locale)} />
      <div className="flex items-center justify-between gap-4">
        <Logo className="text-[30px]" />
        <SignOutButton label={t('signOut')} href={localizedPath(signOutPath, locale)} />
      </div>
      <div
        className={`mx-auto flex w-full max-w-110 flex-1 animate-step-in flex-col py-10 ${
          centered ? 'items-center justify-center text-center' : ''
        }`}
      >
        {children}
      </div>
    </main>
  );
}
