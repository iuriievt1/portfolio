import { Injectable, Logger } from '@nestjs/common';

import { SmsSender, type SmsMessage } from './sms-sender.js';

/** Writes text messages to the log instead of sending them, until an SMS provider is connected. */
@Injectable()
export class LogSmsSender extends SmsSender {
  private readonly logger = new Logger('Sms');

  send(message: SmsMessage): Promise<void> {
    this.logger.log('SMS written to the log, no provider is connected', {
      to: message.to,
      text: message.text,
    });

    return Promise.resolve();
  }
}
