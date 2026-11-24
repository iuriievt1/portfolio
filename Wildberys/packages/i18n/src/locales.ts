export const customerLocales = ['cs', 'en'] as const;
export type CustomerLocale = (typeof customerLocales)[number];
export const defaultCustomerLocale: CustomerLocale = 'cs';

/** Each language under its own name, the way a language switch shows it. */
export const customerLocaleNames: Record<CustomerLocale, string> = {
  cs: 'Čeština',
  en: 'English',
};

/**
 * Each language in two letters, for a compact language switch. Czech is "CZ":
 * people know it from the country, while "cs" is the code computers use for the language.
 */
export const customerLocaleShortNames: Record<CustomerLocale, string> = {
  cs: 'CZ',
  en: 'EN',
};

/** The languages of the store and the seller portal, the way a language switch shows them. */
export const customerLanguages = customerLocales.map((locale) => ({
  locale,
  name: customerLocaleNames[locale],
  shortName: customerLocaleShortNames[locale],
}));

export const adminLocales = ['ru'] as const;
export type AdminLocale = (typeof adminLocales)[number];
export const defaultAdminLocale: AdminLocale = 'ru';

export const timeZone = 'Europe/Prague';
