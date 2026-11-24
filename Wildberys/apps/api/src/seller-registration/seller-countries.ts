import { euCountries, type EuCountry } from '../vat-registry/eu-countries.js';

/** The country whose companies are read from its own register by their company number. */
export const homeCountry = 'CZ' satisfies EuCountry;

/**
 * The countries a company of a seller can be registered in: the member states of the EU.
 * The payment provider pays sellers there, and their companies can be checked in a public register.
 */
export const sellerCountries: readonly EuCountry[] = euCountries;

/** The countries whose companies are registered by a VAT number: every country but the home one. */
export const countriesCheckedByVatNumber: readonly EuCountry[] = euCountries.filter(
  (countryCode) => countryCode !== homeCountry,
);
