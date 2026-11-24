import '../global.css';

import { timeZone } from '@bluberi/i18n/locales';
import { storeMessages } from '@bluberi/i18n/store';
import { Stack } from 'expo-router';
import { IntlProvider } from 'use-intl';

import { getDeviceLocale } from '../i18n/locale';

const locale = getDeviceLocale();

export default function RootLayout() {
  return (
    <IntlProvider locale={locale} messages={storeMessages[locale]} timeZone={timeZone}>
      <Stack />
    </IntlProvider>
  );
}
