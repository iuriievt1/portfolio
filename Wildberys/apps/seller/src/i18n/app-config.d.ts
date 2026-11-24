import type { SellerMessages } from '@bluberi/i18n/seller';
// Loads the module that is extended below. Without it the typed keys work only
// while some file of the app happens to import from 'next-intl'.
import type {} from 'next-intl';

import type { routing } from './routing';

declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: SellerMessages;
  }
}
