import type { CustomerLocale } from '@bluberi/i18n/locales';

import { pageUrl } from './page-metadata';
import { siteUrl } from '../settings';

interface StructuredDataProps {
  readonly locale: CustomerLocale;
  readonly siteName: string;
  readonly description: string;
}

/**
 * Tells search engines in their own format (schema.org) who runs the site and what the site
 * is called. Search results take the name of the site and its logo from here.
 */
export function StructuredData({ locale, siteName, description }: StructuredDataProps) {
  const site = siteUrl();
  const organization = `${site}/#organization`;
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organization,
        name: siteName,
        url: site,
        logo: `${site}/apple-touch-icon.png`,
      },
      {
        '@type': 'WebSite',
        '@id': `${site}/#website`,
        name: siteName,
        url: pageUrl('/', locale),
        description,
        inLanguage: locale,
        publisher: { '@id': organization },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // The texts are ours. "<" is still written as a code, so nothing in them can close the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
