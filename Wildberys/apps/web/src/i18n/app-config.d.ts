import type { StoreMessages } from '@bluberi/i18n/store';

import type { routing } from './routing';

declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: StoreMessages;
  }
}
