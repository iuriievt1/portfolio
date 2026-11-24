import { Module } from '@nestjs/common';

import { AresCompanyRegistry } from './ares-company-registry.js';
import { CompanyLookupService } from './company-lookup.service.js';
import { CompanyRegistryController } from './company-registry.controller.js';
import { CompanyRegistry } from './company-registry.js';

@Module({
  controllers: [CompanyRegistryController],
  providers: [{ provide: CompanyRegistry, useClass: AresCompanyRegistry }, CompanyLookupService],
  exports: [CompanyRegistry, CompanyLookupService],
})
export class CompanyRegistryModule {}
