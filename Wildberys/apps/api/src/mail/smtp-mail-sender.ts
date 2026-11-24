import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

import { AppConfig } from '../config/app-config.js';
import { MailSender, type EmailMessage } from './mail-sender.js';

/** Sends emails through the SMTP server from the settings. Locally that is Mailpit. */
@Injectable()
export class SmtpMailSender extends MailSender implements OnModuleDestroy {
  private readonly transporter: Transporter;

  constructor(private readonly config: AppConfig) {
    super();
    this.transporter = createTransport(config.smtpUrl);
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.config.mailFrom, ...message });
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
