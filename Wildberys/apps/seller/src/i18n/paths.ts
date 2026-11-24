import type { Route } from 'next';

import { routing } from './routing';

export type SellerLocale = (typeof routing.locales)[number];

/** A language that came from outside (a URL, a form) as one of ours. */
export function toLocale(value: string): SellerLocale {
  return routing.locales.find((locale) => locale === value) ?? routing.defaultLocale;
}

/**
 * A path with the language in front where it is needed: /prehled in Czech, /en/prehled in English.
 * For the proxy, server actions and route handlers, where the helpers of next-intl cannot run.
 * Typed routes cannot know a path that is put together at run time, so it is declared a route here.
 */
export function localizedPath(path: string, locale: string): Route {
  const language = toLocale(locale);

  return (language === routing.defaultLocale ? path : `/${language}${path}`) as Route;
}

/** Splits /en/prehled into the language and /prehled. A path without a language is in the default one. */
export function splitLanguage(pathname: string): { locale: SellerLocale; path: string } {
  const [, first = '', ...rest] = pathname.split('/');
  const locale = routing.locales.find((candidate) => candidate === first);

  return locale
    ? { locale, path: `/${rest.join('/')}` }
    : { locale: routing.defaultLocale, path: pathname };
}
