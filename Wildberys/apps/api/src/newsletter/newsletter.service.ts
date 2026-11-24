import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { LiveEvents } from '../live-events/live-events.js';
import type { PageQuery } from '../pagination/page-query.js';
import { toPage } from '../pagination/page.js';
import { newsletterConsentVersion } from './newsletter-policy.js';
import type { NewsletterPage, SubscribeBody, UnsubscribeBody } from './newsletter.dto.js';

/** People who agreed to get news by email. */
@Injectable()
export class NewsletterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveEvents,
  ) {}

  /**
   * Saves a subscription with the consent the person gave. An email that is already on the list
   * stays as it was, and the answer is the same, so nobody learns who has subscribed.
   */
  async subscribe({ email, locale }: SubscribeBody): Promise<void> {
    const { count } = await this.prisma.newsletterSubscription.createMany({
      data: { email, locale, consentVersion: newsletterConsentVersion, consentedAt: new Date() },
      skipDuplicates: true,
    });

    await this.tellOpenPages(count);
  }

  /**
   * Takes the consent back: the subscription is deleted. An email that is not on the list
   * gets the same answer, so nobody learns who has subscribed.
   */
  async unsubscribe({ email }: UnsubscribeBody): Promise<void> {
    const { count } = await this.prisma.newsletterSubscription.deleteMany({ where: { email } });

    await this.tellOpenPages(count);
  }

  /** The list in the admin shows a new or a gone subscription at once. Nothing is told when nothing changed. */
  private async tellOpenPages(changed: number): Promise<void> {
    if (changed > 0) {
      await this.live.report({ kind: 'newsletter-changed' });
    }
  }

  async list({ limit, cursor }: PageQuery): Promise<NewsletterPage> {
    const rows = await this.prisma.newsletterSubscription.findMany({
      where: { id: cursor ? { lt: cursor } : undefined },
      orderBy: { id: 'desc' },
      take: limit + 1,
      select: { id: true, email: true, locale: true, consentedAt: true },
    });

    return toPage(rows, limit);
  }
}
