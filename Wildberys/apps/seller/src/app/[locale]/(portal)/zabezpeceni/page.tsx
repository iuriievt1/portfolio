import { PageTitle } from '@bluberi/ui/components/app-shell';
import { passwordMinLength, signInCodeLength } from '@bluberi/web-auth/session';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { signOutPath } from '../../../../auth/config';
import { getUser } from '../../../../auth/current-user';
import {
  chooseSignInConfirmationChannel,
  confirmPhoneNumber,
  savePassword,
  sendPhoneCode,
} from '../../../../auth/security-actions';
import { ChannelCard } from '../../../../components/security/channel-card';
import { PasswordCard } from '../../../../components/security/password-card';
import { PhoneCard } from '../../../../components/security/phone-card';
import { localizedPath } from '../../../../i18n/paths';

/**
 * How the account is protected: the password, the phone number and where the code
 * of the second step of a sign-in goes. The password and the phone are the two steps
 * of securing the account: each shows its number until it is done and a check mark after.
 */
export default async function SecurityPage() {
  const t = await getTranslations('security');

  return (
    <>
      <PageTitle>{t('title')}</PageTitle>
      {/* The settings belong to the signed-in person, so they wait for the session and stream in. */}
      <Suspense fallback={<SecuritySettingsPlaceholder />}>
        <SecuritySettings />
      </Suspense>
    </>
  );
}

async function SecuritySettings() {
  const user = await getUser();

  if (!user) {
    // The session has ended. The top bar sends the person to the sign-in page.
    return null;
  }

  const locale = await getLocale();
  const t = await getTranslations('security');
  const { security, errors, oneTimeCode, passwordField } = await getMessages();
  const stepCount = 2;

  return (
    <>
      <p className="text-sm font-semibold text-gray-600">{t('account', { email: user.email })}</p>
      <div className="flex flex-col gap-3.5">
        <PasswordCard
          hasPassword={user.hasPassword}
          stepLabel={t('step', { number: 1, count: stepCount })}
          labels={security.password}
          fieldLabels={passwordField}
          minLength={passwordMinLength}
          errors={errors}
          closeLabel={security.close}
          signInAgainLabel={security.signInAgain}
          save={savePassword}
          signOutHref={localizedPath(signOutPath, locale)}
        />
        <PhoneCard
          phone={user.phoneVerified ? user.phone : null}
          next={user.hasPassword && !user.phoneVerified}
          stepLabel={t('step', { number: 2, count: stepCount })}
          labels={security.phone}
          resendLabels={oneTimeCode}
          codeLength={signInCodeLength}
          errors={errors}
          closeLabel={security.close}
          sendCode={sendPhoneCode}
          confirm={confirmPhoneNumber}
        />
        <ChannelCard
          channel={user.signInConfirmationChannel}
          phoneConfirmed={user.phoneVerified}
          labels={security.channel}
          errors={errors}
          choose={chooseSignInConfirmationChannel}
        />
      </div>
    </>
  );
}

/** Holds the place of the settings while the session is read: the same three cards, empty. */
function SecuritySettingsPlaceholder() {
  return (
    <>
      <div aria-hidden className="h-5" />
      <div aria-hidden className="flex flex-col gap-3.5">
        {[0, 1, 2].map((card) => (
          <div key={card} className="h-21.5 rounded-lg border border-gray-200 bg-white" />
        ))}
      </div>
    </>
  );
}
