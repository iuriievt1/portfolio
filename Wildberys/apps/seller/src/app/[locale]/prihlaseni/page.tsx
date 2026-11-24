import { SignInForm } from '@bluberi/ui/components/sign-in-form';
import { passwordMinLength, signInCodeLength } from '@bluberi/web-auth/session';
import { getMessages } from 'next-intl/server';

import {
  confirmSignIn,
  requestCode,
  requestPasswordResetCode,
  resendSignInConfirmation,
  resetPassword,
  signIn,
  signInWithPassword,
  startSignIn,
} from '../../../auth/actions';
import { homePath } from '../../../auth/config';
import { BrandLayout } from '../../../components/brand-layout';
import { localizedPath } from '../../../i18n/paths';

/** Sign-in in the look of the seller registration from design 02: the brand panel and the form. */
export default async function SignInPage({ params }: PageProps<'/[locale]/prihlaseni'>) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <BrandLayout>
      <SignInForm
        labels={{ ...messages.signIn.form, ...messages.oneTimeCode, errors: messages.errors }}
        codeLength={signInCodeLength}
        afterSignInHref={localizedPath(homePath, locale)}
        requestCode={requestCode.bind(null, locale)}
        signIn={signIn}
        password={{
          labels: messages.signIn.password,
          fieldLabels: messages.passwordField,
          minLength: passwordMinLength,
          start: startSignIn.bind(null, locale),
          signIn: signInWithPassword,
          resendConfirmation: resendSignInConfirmation,
          confirm: confirmSignIn,
          requestResetCode: requestPasswordResetCode.bind(null, locale),
          reset: resetPassword,
        }}
      />
    </BrandLayout>
  );
}
