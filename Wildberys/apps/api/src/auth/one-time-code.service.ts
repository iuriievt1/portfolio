import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';

import { AppConfig } from '../config/app-config.js';
import { PrismaService } from '../database/prisma.service.js';
import type { OneTimeCode } from '../generated/prisma/client.js';
import type { Locale, OneTimeCodePurpose } from '../generated/prisma/enums.js';
import { AppException } from '../errors/app.exception.js';
import { invalidOneTimeCode } from './auth-errors.js';
import {
  oneTimeCodeLength,
  oneTimeCodeLifetimeMinutes,
  oneTimeCodeMaxAttempts,
  oneTimeCodeResendSeconds,
} from './auth-policy.js';

/** What a code is for and where it goes. A code works only for the same three values. */
export interface OneTimeCodeTarget {
  readonly purpose: OneTimeCodePurpose;
  /** An email or a phone number. */
  readonly destination: string;
  /** Set when the code belongs to one user: a phone number to confirm, the second step of a sign-in. */
  readonly userId?: string;
}

/** Short codes sent by email or SMS. Only the latest code for a target works. */
@Injectable()
export class OneTimeCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  /** Creates a code and returns it for sending. Refuses when the last one was asked for too recently. */
  async issue(target: OneTimeCodeTarget, locale: Locale): Promise<string> {
    const code = await this.issueUnlessRecent(target, locale);

    if (code === undefined) {
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        'ONE_TIME_CODE_REQUESTED_TOO_SOON',
        'Wait before asking for another code',
      );
    }

    return code;
  }

  /**
   * Creates a code and returns it for sending. Creates nothing and returns nothing when the last one
   * was asked for too recently: that code is still on its way or in the inbox.
   * A code that was used does not count, so signing in again right after signing out works.
   */
  async issueUnlessRecent(target: OneTimeCodeTarget, locale: Locale): Promise<string | undefined> {
    const now = Date.now();
    const recent = await this.prisma.oneTimeCode.findFirst({
      where: {
        ...this.where(target),
        usedAt: null,
        createdAt: { gt: new Date(now - oneTimeCodeResendSeconds * 1000) },
      },
    });

    if (recent) {
      return undefined;
    }

    const code = randomInt(10 ** oneTimeCodeLength)
      .toString()
      .padStart(oneTimeCodeLength, '0');

    await this.prisma.oneTimeCode.create({
      data: {
        ...this.where(target),
        locale,
        codeHash: this.hash(target, code),
        expiresAt: new Date(now + oneTimeCodeLifetimeMinutes * 60 * 1000),
      },
    });

    return code;
  }

  /** Checks a code and uses it up. Every call counts as an attempt, also a wrong one. */
  async redeem(target: OneTimeCodeTarget, code: string): Promise<OneTimeCode> {
    const latest = await this.prisma.oneTimeCode.findFirst({
      where: this.where(target),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    if (!latest) {
      throw invalidOneTimeCode();
    }

    // The attempt is counted before the code is compared, so parallel guesses cannot get extra tries.
    const attempt = await this.prisma.oneTimeCode.updateMany({
      where: {
        id: latest.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: oneTimeCodeMaxAttempts },
      },
      data: { attempts: { increment: 1 } },
    });

    if (attempt.count !== 1) {
      throw invalidOneTimeCode();
    }

    const expected = Buffer.from(latest.codeHash, 'hex');
    const actual = Buffer.from(this.hash(target, code), 'hex');

    if (!timingSafeEqual(actual, expected)) {
      throw invalidOneTimeCode();
    }

    const use = await this.prisma.oneTimeCode.updateMany({
      where: { id: latest.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (use.count !== 1) {
      throw invalidOneTimeCode();
    }

    return latest;
  }

  private where(target: OneTimeCodeTarget): {
    purpose: OneTimeCodePurpose;
    destination: string;
    userId: string | null;
  } {
    return {
      purpose: target.purpose,
      destination: target.destination,
      userId: target.userId ?? null,
    };
  }

  /** A code is only six digits, so it is hashed with a secret key that is not in the database. */
  private hash(target: OneTimeCodeTarget, code: string): string {
    return createHmac('sha256', this.config.oneTimeCodeSecret)
      .update([target.purpose, target.destination, target.userId ?? '', code].join('\n'))
      .digest('hex');
  }
}
