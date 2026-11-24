import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { SellerDocumentsService } from './seller-documents.service.js';

@Module({
  imports: [AuditModule, StorageModule],
  providers: [SellerDocumentsService],
  exports: [SellerDocumentsService],
})
export class SellerDocumentsModule {}
