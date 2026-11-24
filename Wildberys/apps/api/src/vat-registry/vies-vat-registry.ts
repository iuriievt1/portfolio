import { Injectable } from '@nestjs/common';

import { AppConfig } from '../config/app-config.js';
import { getJson, type JsonAnswer } from '../http/get-json.js';
import { vatLetters, type EuCountry } from './eu-countries.js';
import { vatRegistryUnavailable } from './vat-registry-errors.js';
import { VatRegistry, type VatRecord } from './vat-registry.js';
import { readViesAnswer } from './vies-answer.js';

/**
 * A person waits for this answer in a form. VIES asks the register of the country itself,
 * so it gets a little longer than a register that answers from its own data.
 */
const timeoutMilliseconds = 12_000;

/** Checks VAT numbers in VIES, the service of the European Commission that asks the register of each country. */
@Injectable()
export class ViesVatRegistry extends VatRegistry {
  constructor(private readonly config: AppConfig) {
    super();
  }

  async find(countryCode: EuCountry, number: string): Promise<VatRecord | null> {
    // VIES knows a country by the letters of its VAT numbers.
    const viesCountry = vatLetters(countryCode);
    let answer: JsonAnswer;

    try {
      answer = await getJson(
        `${this.config.viesUrl}/ms/${viesCountry}/vat/${encodeURIComponent(number)}`,
        timeoutMilliseconds,
      );
    } catch (error) {
      throw vatRegistryUnavailable(error);
    }

    const read = answer.ok ? readViesAnswer(viesCountry, answer.body) : undefined;

    if (!read || read.status === 'unavailable') {
      throw vatRegistryUnavailable();
    }

    return read.status === 'valid' ? read.record : null;
  }
}
