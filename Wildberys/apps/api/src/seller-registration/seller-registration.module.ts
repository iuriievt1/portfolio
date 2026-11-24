import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { CompanyRegistryModule } from '../company-registry/company-registry.module.js';
import { LiveEventsModule } from '../live-events/live-events.module.js';
import { PayoutsModule } from '../payouts/payouts.module.js';
import { SellerDocumentsModule } from '../seller-documents/seller-documents.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { VatRegistryModule } from '../vat-registry/vat-registry.module.js';
import { ReportSellerChange } from './report-seller-change.js';
import { SellerRegistrationController } from './seller-registration.controller.js';
import { SellerRegistrationService } from './seller-registration.service.js';

@Module({
  imports: [
    AuditModule,
    CategoriesModule,
    CompanyRegistryModule,
    LiveEventsModule,
    PayoutsModule,
    SellerDocumentsModule,
    StorageModule,
    VatRegistryModule,
  ],
  controllers: [SellerRegistrationController],
  providers: [ReportSellerChange, SellerRegistrationService],
})
export class SellerRegistrationModule {}
