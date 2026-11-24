import { Injectable } from '@nestjs/common';

import { AppException } from '../errors/app.exception.js';
import type { EuCountry } from './eu-countries.js';
import { vatNumberNotFound } from './vat-registry-errors.js';
import { VatRegistry, type VatRecord } from './vat-registry.js';

/** Finds a VAT number a seller can be registered with: one the register says is valid. */
@Injectable()
export class VatLookupService {
  constructor(private readonly registry: VatRegistry) {}

  async find(countryCode: EuCountry, number: string): Promise<VatRecord> {
    const record = await this.registry.find(countryCode, number);

    if (!record) {
      throw vatNumberNotFound();
    }

    return record;
  }

  /**
   * The same, for a caller that has another way to check a company: undefined when the register
   * does not answer. A number the register calls not valid is still an error.
   */
  async findIfAnswered(countryCode: EuCountry, number: string): Promise<VatRecord | undefined> {
    try {
      return await this.find(countryCode, number);
    } catch (error) {
      if (error instanceof AppException && error.code === 'VAT_REGISTRY_UNAVAILABLE') {
        return undefined;
      }

      throw error;
    }
  }
}
