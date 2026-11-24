/**
 * The country whose companies are found in its own register by their company number.
 * A company of any other country of the registration gives its VAT number.
 */
export const homeCountry = 'CZ';

export interface CountryChoice {
  readonly code: string;
  readonly name: string;
}

/** The countries of the registration by their names in the language of the page, the home country first. */
export function countryChoices(codes: readonly string[], locale: string): CountryChoice[] {
  const names = new Intl.DisplayNames(locale, { type: 'region' });
  const collator = new Intl.Collator(locale);

  return codes
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort(
      (first, second) =>
        Number(second.code === homeCountry) - Number(first.code === homeCountry) ||
        collator.compare(first.name, second.name),
    );
}
