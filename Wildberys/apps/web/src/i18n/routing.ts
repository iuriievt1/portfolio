import { customerLocales, defaultCustomerLocale } from '@bluberi/i18n/locales';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: customerLocales,
  defaultLocale: defaultCustomerLocale,
  localePrefix: 'as-needed',
  // The pages and the sitemap say where each language lives, with the public address of the store.
  // The links next-intl would add to every answer are built from the address of the request.
  alternateLinks: false,
});
