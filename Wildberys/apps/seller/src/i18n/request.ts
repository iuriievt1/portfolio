import { timeZone } from '@bluberi/i18n/locales';
import { sellerMessages } from '@bluberi/i18n/seller';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as rootParams from 'next/root-params';

import { routing } from './routing';

export default getRequestConfig(async ({ locale }) => {
  const requestedLocale = locale ?? (await rootParams.locale());

  if (!hasLocale(routing.locales, requestedLocale)) {
    notFound();
  }

  return {
    locale: requestedLocale,
    messages: sellerMessages[requestedLocale],
    timeZone,
  };
});
