import type { AdminMessages } from '@bluberi/i18n/admin';
import type { AdminLocale } from '@bluberi/i18n/locales';
// Loads the module that is extended below. Without it the typed keys work only
// while some file of the app happens to import from 'next-intl'.
import type {} from 'next-intl';

declare module 'next-intl' {
  interface AppConfig {
    Locale: AdminLocale;
    Messages: AdminMessages;
  }
}
