import { Module } from '@nestjs/common';

import { LiveEventsModule } from '../live-events/live-events.module.js';
import { NewsletterAdminController, NewsletterController } from './newsletter.controller.js';
import { NewsletterService } from './newsletter.service.js';

@Module({
  imports: [LiveEventsModule],
  controllers: [NewsletterController, NewsletterAdminController],
  providers: [NewsletterService],
})
export class NewsletterModule {}
