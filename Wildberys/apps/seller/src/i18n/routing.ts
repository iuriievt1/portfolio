import { customerLocales, defaultCustomerLocale } from '@bluberi/i18n/locales';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: customerLocales,
  defaultLocale: defaultCustomerLocale,
  localePrefix: 'as-needed',
});
