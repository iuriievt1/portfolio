import { Module } from '@nestjs/common';

import { LiveEvents } from './live-events.js';
import { SellerLiveStreamController, TeamLiveStreamController } from './live-streams.controller.js';
import { RedisLiveEvents } from './redis-live-events.js';

@Module({
  controllers: [SellerLiveStreamController, TeamLiveStreamController],
  providers: [{ provide: LiveEvents, useClass: RedisLiveEvents }],
  exports: [LiveEvents],
})
export class LiveEventsModule {}
