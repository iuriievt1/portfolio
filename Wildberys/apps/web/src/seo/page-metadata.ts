import type { CustomerLocale } from '@bluberi/i18n/locales';
import type { Metadata } from 'next';

import { getPathname } from '../i18n/navigation';
import { routing } from '../i18n/routing';
import { siteUrl } from '../settings';

/** The size social networks ask for: the picture of a shared link. */
export const socialImageSize = { width: 1200, height: 630 } as const;

/** How Open Graph names each language of the store. */
const openGraphLocales: Record<CustomerLocale, string> = { cs: 'cs_CZ', en: 'en_GB' };

/** The full address of a page in one language. The first page is the address of the site itself. */
export function pageUrl(path: string, locale: CustomerLocale): string {
  const pathname = getPathname({ href: path, locale });

  return pathname === '/' ? siteUrl() : `${siteUrl()}${pathname}`;
}

/** The picture of a shared link. It has the title of the first screen, so each language has its own. */
export function socialImagePath(locale: CustomerLocale): string {
  return `/social/bluberi-${locale}.jpg`;
}

interface PageDetails {
  readonly locale: CustomerLocale;
  /** The path of the page without the language, as in `paths.ts`. */
  readonly path: string;
  readonly title: string;
  /** The title stands alone in the browser tab, without the name of the store after it. */
  readonly titleIsWhole?: boolean;
  readonly description: string;
  readonly siteName: string;
  /** What the picture of a shared link shows, for people who cannot see it. */
  readonly socialImageAlt: string;
}

/**
 * What search engines and social networks read about a page: its title and description,
 * its one true address, the same page in the other languages and the preview of a shared link.
 */
export function pageMetadata({
  locale,
  path,
  title,
  titleIsWhole = false,
  description,
  siteName,
  socialImageAlt,
}: PageDetails): Metadata {
  const url = pageUrl(path, locale);
  const image = { url: socialImagePath(locale), ...socialImageSize, alt: socialImageAlt };

  return {
    title: titleIsWhole ? { absolute: title } : title,
    description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(
          routing.locales.map((language) => [language, pageUrl(path, language)]),
        ),
        // For a visitor whose language we do not have: the address that picks one for them.
        'x-default': pageUrl(path, routing.defaultLocale),
      },
    },
    openGraph: {
      type: 'website',
      url,
      siteName,
      title,
      description,
      locale: openGraphLocales[locale],
      alternateLocale: routing.locales
        .filter((language) => language !== locale)
        .map((language) => openGraphLocales[language]),
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
