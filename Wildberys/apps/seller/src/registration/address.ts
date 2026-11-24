import { homeCountry } from './countries';

/** An address as a person types it: the country is the one of the seller. */
export interface PostalAddress {
  readonly street: string;
  readonly city: string;
  readonly postalCode: string;
}

/** Five digits the way people write a Czech postal code: 10100 or 101 00. */
const czechPostalCodeAsTyped = String.raw`[0-9]{3} ?[0-9]{2}`;
/** A postal code of another country: letters, digits, spaces and dashes, like 61-569 and 1012 AB. */
const postalCodeAsTyped = String.raw`[A-Za-z0-9][A-Za-z0-9 \-]{1,9}[A-Za-z0-9]`;

/** What the postal code field of an address in this country takes. */
export function postalCodeField(countryCode: string): {
  readonly pattern: string;
  readonly maxLength: number;
  readonly inputMode: 'numeric' | 'text';
} {
  return countryCode === homeCountry
    ? { pattern: czechPostalCodeAsTyped, maxLength: 6, inputMode: 'numeric' }
    : { pattern: postalCodeAsTyped, maxLength: 12, inputMode: 'text' };
}

/** A postal code the way the API takes it. A Czech one is five digits in one piece. */
export function postalCodeOf(countryCode: string, typed: string): string {
  return countryCode === homeCountry ? typed.replace(/\s+/g, '') : typed.trim();
}

/**
 * An address in one line: "Korunní 2569/108, 101 00 Praha 10". A Czech postal code is stored
 * in one piece and written in two groups. A code of another country is written as it is stored.
 */
export function addressLine({
  street,
  postalCode,
  city,
  countryCode,
}: PostalAddress & { readonly countryCode: string }): string {
  const code =
    countryCode === homeCountry ? `${postalCode.slice(0, 3)} ${postalCode.slice(3)}` : postalCode;

  return `${street}, ${code} ${city}`;
}
