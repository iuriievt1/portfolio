import { Module } from '@nestjs/common';

import { LogSmsSender } from './log-sms-sender.js';
import { SmsSender } from './sms-sender.js';

@Module({
  providers: [{ provide: SmsSender, useClass: LogSmsSender }],
  exports: [SmsSender],
})
export class SmsModule {}
