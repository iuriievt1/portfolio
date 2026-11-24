import { operator } from '@bluberi/i18n/operator';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { Locale, SellerMemberRole } from '../generated/prisma/enums.js';
import { MailSender } from '../mail/mail-sender.js';
import { fillMessage, getNotificationMessages } from '../messages/notification-messages.js';

/** Whom an email about a seller is written to, and about which company. */
interface Recipient {
  readonly email: string;
  readonly locale: Locale;
  readonly company: string;
}

type Email =
  | 'sellerApprovedEmail'
  | 'sellerDocumentsRequestedEmail'
  | 'sellerRejectedEmail'
  | 'sellerMessageEmail';

/**
 * Tells a seller by email what the team decided or wrote, in the language of the owner.
 * The same words stand in the messages of the portal: the email only brings the seller there.
 */
@Injectable()
export class SellerNotifier {
  private readonly logger = new Logger('SellerMessages');

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailSender,
  ) {}

  approved(sellerId: string): Promise<void> {
    return this.send('sellerApprovedEmail', sellerId);
  }

  documentsRequested(sellerId: string, message: string): Promise<void> {
    return this.send('sellerDocumentsRequestedEmail', sellerId, message);
  }

  rejected(sellerId: string, message: string): Promise<void> {
    return this.send('sellerRejectedEmail', sellerId, message);
  }

  /** The team wrote to the seller in the messages of the portal. */
  messageFromTeam(sellerId: string, message: string): Promise<void> {
    return this.send('sellerMessageEmail', sellerId, message);
  }

  /**
   * What the email is about is saved before the email goes out. An email that cannot be sent does not
   * take it back: the seller sees it in the portal, and the failure is written to the log.
   */
  private async send(email: Email, sellerId: string, message = ''): Promise<void> {
    try {
      const recipient = await this.recipientOf(sellerId);
      const { subject, text } = getNotificationMessages(recipient.locale)[email];
      const values = { company: recipient.company, message, supportEmail: operator.supportEmail };

      await this.mail.send({
        to: recipient.email,
        subject: fillMessage(subject, values),
        text: fillMessage(text, values),
      });
    } catch (error) {
      this.logger.error('An email to a seller was not sent', { email, sellerId, error });
    }
  }

  /** The contact email of the seller, with the language of its owner. */
  private async recipientOf(sellerId: string): Promise<Recipient> {
    const seller = await this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      select: {
        contactEmail: true,
        legalName: true,
        members: {
          where: { role: SellerMemberRole.OWNER },
          take: 1,
          select: { user: { select: { locale: true } } },
        },
      },
    });

    return {
      email: seller.contactEmail,
      locale: seller.members[0]?.user.locale ?? Locale.cs,
      company: seller.legalName,
    };
  }
}
