import { SignInForm } from '@bluberi/ui/components/sign-in-form';
import { SignInLayout } from '@bluberi/ui/components/sign-in-layout';
import { signInCodeLength } from '@bluberi/web-auth/session';
import { getMessages, getTranslations } from 'next-intl/server';

import { requestCode, signIn } from '../../auth/actions';
import { homePath } from '../../auth/config';

/** Sign-in in the look of the seller registration from design 02: the brand panel and the form. */
export default async function SignInPage() {
  const t = await getTranslations('signIn');
  const messages = await getMessages();

  return (
    <SignInLayout panelTitle={t('panelTitle')}>
      <SignInForm
        labels={messages.signIn.form}
        codeLength={signInCodeLength}
        afterSignInHref={homePath}
        requestCode={requestCode}
        signIn={signIn}
      />
    </SignInLayout>
  );
}
