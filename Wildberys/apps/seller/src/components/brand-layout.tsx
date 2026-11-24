import { SignInLayout } from '@bluberi/ui/components/sign-in-layout';
import { BadgeCheck, Megaphone, UploadCloud, Wallet } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { LanguageSwitcher } from './language-switcher';

interface BrandLayoutProps {
  /** Shown next to the language switch, for example the button to sign out. */
  readonly headerAction?: ReactNode;
  readonly children: ReactNode;
}

/**
 * The screen a seller sees before the portal, on the sign-in and in the registration:
 * the brand panel with what Bluberi gives a seller, and a form next to it.
 */
export async function BrandLayout({ headerAction, children }: BrandLayoutProps) {
  const t = await getTranslations();

  return (
    <SignInLayout
      panelTitle={t('signIn.panelTitle')}
      benefits={[
        { icon: <BadgeCheck />, label: t('signIn.benefits.free') },
        { icon: <Wallet />, label: t('signIn.benefits.payouts') },
        { icon: <Megaphone />, label: t('signIn.benefits.promotion') },
        { icon: <UploadCloud />, label: t('signIn.benefits.upload') },
      ]}
      headerAction={
        // As tall as the button to sign out, so the page does not move when the button appears.
        <div className="flex min-h-11 items-center gap-2.5">
          <LanguageSwitcher label={t('shell.language')} />
          {headerAction}
        </div>
      }
    >
      {children}
    </SignInLayout>
  );
}
