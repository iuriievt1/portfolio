import { Module } from '@nestjs/common';

import { LiveEventsModule } from '../live-events/live-events.module.js';
import { MailModule } from '../mail/mail.module.js';
import {
  SellerInboxController,
  TeamInboxController,
  TeamNewConversationController,
} from './seller-messages.controller.js';
import { SellerMessagesService } from './seller-messages.service.js';
import { SellerNotifier } from './seller-notifier.js';

@Module({
  imports: [LiveEventsModule, MailModule],
  controllers: [SellerInboxController, TeamInboxController, TeamNewConversationController],
  providers: [SellerMessagesService, SellerNotifier],
  exports: [SellerMessagesService, SellerNotifier],
})
export class SellerMessagesModule {}
