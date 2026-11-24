import { passwordMinLength, signInCodeLength } from '@bluberi/web-auth/session';
import { getMessages } from 'next-intl/server';
import { Suspense } from 'react';

import { signIn, startSignIn } from '../../../auth/actions';
import { signInPath, signOutPath } from '../../../auth/config';
import { confirmPhoneNumber, savePassword, sendPhoneCode } from '../../../auth/security-actions';
import { AccountStep } from '../../../components/registration/account-step';
import { RegistrationShell } from '../../../components/registration/registration-shell';
import { Terms } from '../../../components/registration/terms';
import { localizedPath } from '../../../i18n/paths';
import { getRegistration } from '../../../registration/registration';
import { pagePaths } from '../../../registration/steps';

/** Step 1 of the seller registration from design 02: the account. It is open to people without one. */
export default async function AccountPage({ params }: PageProps<'/[locale]/registrace'>) {
  const { locale } = await params;

  return (
    <RegistrationShell step="account">
      {/* Who is signed in depends on the request, so the step streams in. */}
      <Suspense fallback={null}>
        <Account locale={locale} />
      </Suspense>
    </RegistrationShell>
  );
}

async function Account({ locale }: { readonly locale: string }) {
  const registration = await getRegistration();
  const messages = await getMessages();
  const { account, haveAccount, signIn: signInLabel } = messages.registration;

  return (
    <AccountStep
      account={registration?.account ?? null}
      labels={{
        ...account,
        passwordHint: messages.passwordField.hint,
        haveAccount,
        signIn: signInLabel,
        continue: messages.registration.continue,
      }}
      resendLabels={messages.oneTimeCode}
      passwordToggleLabels={messages.passwordField}
      terms={<Terms locale={locale} />}
      errors={messages.errors}
      codeLength={signInCodeLength}
      passwordMinLength={passwordMinLength}
      nextHref={localizedPath(pagePaths.company, locale)}
      signInHref={localizedPath(signInPath, locale)}
      signOutHref={localizedPath(signOutPath, locale)}
      startSignIn={startSignIn.bind(null, locale)}
      signIn={signIn}
      sendPhoneCode={sendPhoneCode}
      confirmPhone={confirmPhoneNumber}
      savePassword={savePassword}
    />
  );
}
