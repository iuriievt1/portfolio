import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { CompanyRegistryModule } from '../company-registry/company-registry.module.js';
import { LiveEventsModule } from '../live-events/live-events.module.js';
import { PayoutsModule } from '../payouts/payouts.module.js';
import { SellerDocumentsModule } from '../seller-documents/seller-documents.module.js';
import { SellerMessagesModule } from '../seller-messages/seller-messages.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { VatRegistryModule } from '../vat-registry/vat-registry.module.js';
import { SellerModerationController } from './seller-moderation.controller.js';
import { SellerModerationService } from './seller-moderation.service.js';

@Module({
  imports: [
    AuditModule,
    CompanyRegistryModule,
    LiveEventsModule,
    PayoutsModule,
    SellerDocumentsModule,
    SellerMessagesModule,
    StorageModule,
    VatRegistryModule,
  ],
  controllers: [SellerModerationController],
  providers: [SellerModerationService],
})
export class SellerModerationModule {}
