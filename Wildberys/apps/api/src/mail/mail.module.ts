import { Module } from '@nestjs/common';

import { MailSender } from './mail-sender.js';
import { SmtpMailSender } from './smtp-mail-sender.js';

@Module({
  providers: [{ provide: MailSender, useClass: SmtpMailSender }],
  exports: [MailSender],
})
export class MailModule {}
