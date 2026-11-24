import { customerLocales, defaultCustomerLocale, type CustomerLocale } from '@bluberi/i18n/locales';
import { getLocales } from 'expo-localization';

function isCustomerLocale(value: string | null): value is CustomerLocale {
  return customerLocales.some((locale) => locale === value);
}

export function getDeviceLocale(): CustomerLocale {
  const deviceLanguage = getLocales()[0].languageCode;

  return isCustomerLocale(deviceLanguage) ? deviceLanguage : defaultCustomerLocale;
}
