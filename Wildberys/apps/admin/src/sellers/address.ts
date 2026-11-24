import type { CompanyAddress } from '@bluberi/api-client';

/** The country whose companies the company register and the trade register know. */
export const homeCountry = 'CZ';

/** Says the name of a country in the language of the screen. A code without a name stays a code. */
export type CountryNamer = (countryCode: string) => string;

export function countryNamer(locale: string): CountryNamer {
  const names = new Intl.DisplayNames(locale, { type: 'region' });

  return (countryCode) => names.of(countryCode) ?? countryCode;
}

/** An address in one line, with its country: "Korunní 2569/108, 10100 Praha 10, Чехия". */
export function addressLine(address: CompanyAddress, countryName: CountryNamer): string {
  return `${address.street}, ${address.postalCode} ${address.city}, ${countryName(address.countryCode)}`;
}
