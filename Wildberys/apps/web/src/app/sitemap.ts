import type { MetadataRoute } from 'next';

import { routing } from '../i18n/routing';
import { privacyPolicyPath } from '../paths';
import { pageUrl } from '../seo/page-metadata';

/** The pages search engines should know. A page they must not list, like the unsubscribe page, is not here. */
const pages = ['/', privacyPolicyPath] as const;

/** The list of pages for search engines, each with its address in every language. */
export default function sitemap(): MetadataRoute.Sitemap {
  return pages.flatMap((path) => {
    const languages = {
      ...Object.fromEntries(routing.locales.map((locale) => [locale, pageUrl(path, locale)])),
      'x-default': pageUrl(path, routing.defaultLocale),
    };

    return routing.locales.map((locale) => ({
      url: pageUrl(path, locale),
      alternates: { languages },
    }));
  });
}
