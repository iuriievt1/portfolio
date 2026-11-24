import { Button } from '@bluberi/ui/components/button';
import { Logo } from '@bluberi/ui/components/logo';
import { getTranslations } from 'next-intl/server';

import { signOutPath } from '../auth/config';

/** Shown to a signed-in person who has no role in the Bluberi team, in place of the admin. */
export async function NoAccess() {
  const t = await getTranslations('shell');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center">
      <Logo className="text-[28px]" />
      <h1 className="mt-4 text-[26px] font-extrabold tracking-[-0.02em]">{t('noAccessTitle')}</h1>
      <p className="max-w-110 text-[15px] font-medium text-gray-600">{t('noAccessText')}</p>
      {/* A plain form: the answer loads the sign-in page in full. */}
      <form method="post" action={signOutPath}>
        <Button type="submit">{t('signOut')}</Button>
      </form>
    </main>
  );
}
