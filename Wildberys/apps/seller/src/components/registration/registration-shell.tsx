import { SignOutButton } from '@bluberi/ui/components/sign-out-button';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense, type ReactNode } from 'react';

import { signOutPath } from '../../auth/config';
import { localizedPath } from '../../i18n/paths';
import { getRegistration } from '../../registration/registration';
import type { RegistrationStep } from '../../registration/steps';
import { BrandLayout } from '../brand-layout';
import { RegistrationSteps } from './registration-steps';

interface RegistrationShellProps {
  readonly step: RegistrationStep;
  readonly children: ReactNode;
}

/** A signed-in person can leave the account they started the registration with. */
async function SignOut({ label, href }: { readonly label: string; readonly href: string }) {
  return (await getRegistration()) ? <SignOutButton label={label} href={href} /> : null;
}

/**
 * The screen of the seller registration: the brand panel and one narrow column with the steps
 * and the step the person is at. The frame is the same for everyone, so it is drawn at once.
 * What depends on the person streams in.
 */
export async function RegistrationShell({ step, children }: RegistrationShellProps) {
  const locale = await getLocale();
  const t = await getTranslations();

  return (
    <BrandLayout
      headerAction={
        <Suspense fallback={null}>
          <SignOut label={t('shell.signOut')} href={localizedPath(signOutPath, locale)} />
        </Suspense>
      }
    >
      <div className="mx-auto flex w-full max-w-110 flex-1 flex-col pt-8 pb-4 sm:pt-12">
        <RegistrationSteps
          current={step}
          label={t('registration.steps.label')}
          names={{
            account: t('registration.steps.account'),
            company: t('registration.steps.company'),
            payouts: t('registration.steps.payouts'),
            store: t('registration.steps.store'),
          }}
        />
        {children}
      </div>
    </BrandLayout>
  );
}
