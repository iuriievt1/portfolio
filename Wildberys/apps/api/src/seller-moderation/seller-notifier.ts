import { operator } from '@bluberi/i18n/operator';
import { Injectable, Logger } from '@nestjs/common';

import type { Locale } from '../generated/prisma/enums.js';
import { MailSender } from '../mail/mail-sender.js';
import { fillMessage, getNotificationMessages } from '../messages/notification-messages.js';

/** Whom a decision is written to, and about which company. */
export interface DecisionRecipient {
  readonly email: string;
  readonly locale: Locale;
  readonly company: string;
}

type Decision = 'sellerApprovedEmail' | 'sellerDocumentsRequestedEmail' | 'sellerRejectedEmail';

/** Tells a seller by email what the team decided about the registration, in the language of its owner. */
@Injectable()
export class SellerNotifier {
  private readonly logger = new Logger('SellerModeration');

  constructor(private readonly mail: MailSender) {}

  approved(recipient: DecisionRecipient): Promise<void> {
    return this.send('sellerApprovedEmail', recipient);
  }

  documentsRequested(recipient: DecisionRecipient, message: string): Promise<void> {
    return this.send('sellerDocumentsRequestedEmail', recipient, message);
  }

  rejected(recipient: DecisionRecipient, message: string): Promise<void> {
    return this.send('sellerRejectedEmail', recipient, message);
  }

  /**
   * The decision is saved before the email goes out. An email that cannot be sent does not take
   * the decision back: the seller sees it in the portal, and the failure is written to the log.
   */
  private async send(
    decision: Decision,
    { email, locale, company }: DecisionRecipient,
    message = '',
  ): Promise<void> {
    const { subject, text } = getNotificationMessages(locale)[decision];
    const values = { company, message, supportEmail: operator.supportEmail };

    try {
      await this.mail.send({
        to: email,
        subject: fillMessage(subject, values),
        text: fillMessage(text, values),
      });
    } catch (error) {
      this.logger.error('The email about a decision on a seller was not sent', { decision, error });
    }
  }
}
