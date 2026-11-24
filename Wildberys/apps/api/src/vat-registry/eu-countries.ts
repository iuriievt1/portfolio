/** The member states of the EU, ISO 3166-1 alpha-2. The register of VAT numbers covers them. */
export const euCountries = [
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
] as const;

export type EuCountry = (typeof euCountries)[number];

/** VAT numbers of Greece start with EL. Everywhere else they start with the letters of the country. */
const ownVatLetters: Partial<Record<EuCountry, string>> = { GR: 'EL' };

/** The two letters a VAT number of this country starts with: PL, EL. */
export function vatLetters(countryCode: EuCountry): string {
  return ownVatLetters[countryCode] ?? countryCode;
}
