import { adminMessages } from '@bluberi/i18n/admin';
import { defaultAdminLocale, timeZone } from '@bluberi/i18n/locales';
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(() => ({
  locale: defaultAdminLocale,
  messages: adminMessages[defaultAdminLocale],
  timeZone,
}));
