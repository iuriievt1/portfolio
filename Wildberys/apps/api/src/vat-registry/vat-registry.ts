import type { EuCountry } from './eu-countries.js';

/** What the register says about a VAT number that is valid. */
export interface VatRecord {
  /** The number with the letters of its country in front, the way it is written on invoices: PL5252674798. */
  readonly vatNumber: string;
  /** The name the number is registered under. Null when its country does not share names. */
  readonly name: string | null;
  /** The address in one line, as the register writes it. Null when its country does not share addresses. */
  readonly address: string | null;
}

/**
 * The register of VAT numbers. The rest of the API depends on this class,
 * not on the service that answers today.
 */
export abstract class VatRegistry {
  /**
   * The record of a VAT number, or null when the register says the number is not valid.
   * The number comes without the letters of its country.
   */
  abstract find(countryCode: EuCountry, number: string): Promise<VatRecord | null>;
}
