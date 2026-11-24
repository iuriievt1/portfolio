import { getTranslations } from 'next-intl/server';

import { privacyPolicyUrl } from '../../settings';

/**
 * The sentence a seller agrees to in the registration. The privacy policy is a page of the store,
 * so it opens in a new tab and the registration stays where it is.
 */
export async function Terms({ locale }: { readonly locale: string }) {
  const t = await getTranslations('registration.account');

  return t.rich('terms', {
    policy: (chunks) => (
      <a
        href={privacyPolicyUrl(locale)}
        target="_blank"
        rel="noreferrer"
        className="font-bold text-berry-600 outline-none hover:text-berry-700 focus-visible:underline"
      >
        {chunks}
      </a>
    ),
  });
}
