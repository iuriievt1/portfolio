import { Module } from '@nestjs/common';

import { VatLookupService } from './vat-lookup.service.js';
import { VatRegistryController } from './vat-registry.controller.js';
import { VatRegistry } from './vat-registry.js';
import { ViesVatRegistry } from './vies-vat-registry.js';

@Module({
  controllers: [VatRegistryController],
  providers: [{ provide: VatRegistry, useClass: ViesVatRegistry }, VatLookupService],
  exports: [VatRegistry, VatLookupService],
})
export class VatRegistryModule {}
