import type { CustomerLocale } from '@bluberi/i18n/locales';
import type { StoreMessages } from '@bluberi/i18n/store';

declare module 'use-intl' {
  interface AppConfig {
    Locale: CustomerLocale;
    Messages: StoreMessages;
  }
}
