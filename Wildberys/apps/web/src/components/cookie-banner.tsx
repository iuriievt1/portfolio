import { useTranslations } from 'next-intl';

import { Link } from '../i18n/navigation';
import { cookiesAnchor, privacyPolicyPath } from '../paths';
import { analyticsId } from '../settings';
import { CookieConsent } from './cookie-consent';
import { textLink } from './layout';

/**
 * The question about cookies on every page of the store. It exists only where there is something
 * to ask about: a store without Google Analytics keeps nothing that needs a consent.
 */
export function CookieBanner() {
  const t = useTranslations('cookies');
  const id = analyticsId();

  if (!id) {
    return null;
  }

  return (
    <CookieConsent
      analyticsId={id}
      labels={{
        label: t('label'),
        text: t.rich('text', {
          policy: (chunks) => (
            <Link
              href={{ pathname: privacyPolicyPath, hash: cookiesAnchor }}
              className={`whitespace-nowrap ${textLink}`}
            >
              {chunks}
            </Link>
          ),
        }),
        accept: t('accept'),
        decline: t('decline'),
      }}
    />
  );
}
