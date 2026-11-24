import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { SellerMembersController } from './seller-members.controller.js';
import { SellerMembersService } from './seller-members.service.js';

@Module({
  imports: [AuditModule],
  controllers: [SellerMembersController],
  providers: [SellerMembersService],
})
export class SellerMembersModule {}
