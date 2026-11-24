import { Injectable } from '@nestjs/common';

import type { Locale } from '../generated/prisma/enums.js';
import { MailSender } from '../mail/mail-sender.js';
import { fillMessage, getNotificationMessages } from '../messages/notification-messages.js';
import { SmsSender } from '../sms/sms-sender.js';
import { oneTimeCodeLifetimeMinutes } from './auth-policy.js';
import type { SignInApp } from './auth.dto.js';

/** Sends one-time codes to the user in their language. */
@Injectable()
export class AuthNotifier {
  constructor(
    private readonly mail: MailSender,
    private readonly sms: SmsSender,
  ) {}

  /** The email names the app the person signs in to: Bluberi, Bluberi Seller or Bluberi Admin. */
  async sendSignInCode(email: string, code: string, locale: Locale, app: SignInApp): Promise<void> {
    const { subject, text, products } = getNotificationMessages(locale).signInCodeEmail;

    await this.sendCodeEmail({ subject, text }, email, code, { product: products[app] });
  }

  /** The same kind of code as for a sign-in, in an email that says it is for a new password. */
  async sendPasswordResetCode(email: string, code: string, locale: Locale): Promise<void> {
    await this.sendCodeEmail(getNotificationMessages(locale).passwordResetCodeEmail, email, code);
  }

  private async sendCodeEmail(
    { subject, text }: { readonly subject: string; readonly text: string },
    email: string,
    code: string,
    more: Record<string, string> = {},
  ): Promise<void> {
    const values = { ...more, code, minutes: oneTimeCodeLifetimeMinutes };

    await this.mail.send({
      to: email,
      subject: fillMessage(subject, values),
      text: fillMessage(text, values),
    });
  }

  async sendPhoneCode(phone: string, code: string, locale: Locale): Promise<void> {
    const { text } = getNotificationMessages(locale).phoneCodeSms;

    await this.sms.send({
      to: phone,
      text: fillMessage(text, { code, minutes: oneTimeCodeLifetimeMinutes }),
    });
  }
}
