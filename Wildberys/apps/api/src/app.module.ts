import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AccessGuard } from './access/access.guard.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CompanyRegistryModule } from './company-registry/company-registry.module.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { ImagesModule } from './images/images.module.js';
import { SellerMembersModule } from './seller-members/seller-members.module.js';
import { SellerMessagesModule } from './seller-messages/seller-messages.module.js';
import { SellerModerationModule } from './seller-moderation/seller-moderation.module.js';
import { SellerRegistrationModule } from './seller-registration/seller-registration.module.js';
import { TeamModule } from './team/team.module.js';
import { NewsletterModule } from './newsletter/newsletter.module.js';
import { VatRegistryModule } from './vat-registry/vat-registry.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuditModule,
    AuthModule,
    CategoriesModule,
    CompanyRegistryModule,
    HealthModule,
    ImagesModule,
    SellerMembersModule,
    SellerMessagesModule,
    SellerModerationModule,
    SellerRegistrationModule,
    TeamModule,
    NewsletterModule,
    VatRegistryModule,
  ],
  providers: [
    // Both guards run for every route, in this order: first who makes the request, then what they may do.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
export class AppModule {}
