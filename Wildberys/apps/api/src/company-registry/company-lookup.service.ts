import { Injectable } from '@nestjs/common';

import { companyNotActive, companyNotFound } from './company-registry-errors.js';
import { CompanyRegistry, type RegistryCompany } from './company-registry.js';

/** Finds a company a seller can be registered for: one the register knows and that still exists. */
@Injectable()
export class CompanyLookupService {
  constructor(private readonly registry: CompanyRegistry) {}

  async find(ico: string): Promise<RegistryCompany> {
    const company = await this.registry.find(ico);

    if (!company) {
      throw companyNotFound();
    }

    if (!company.isActive) {
      throw companyNotActive();
    }

    return company;
  }
}
