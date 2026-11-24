import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { DatabaseClient } from '../database/database-client.js';
import { PrismaService } from '../database/prisma.service.js';
import { UserStatus, type SignInMethod } from '../generated/prisma/enums.js';
import { AccessTokenService } from './access-token.service.js';
import { accountBlocked, invalidRefreshToken } from './auth-errors.js';
import { accessTokenLifetimeSeconds, sessionLifetimeDays } from './auth-policy.js';
import type { AuthTokens } from './auth.dto.js';

const refreshTokenBytes = 32;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

interface RefreshToken {
  readonly token: string;
  readonly hash: string;
}

/** The token is long and random, so a plain hash is enough to store it safely. */
function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createRefreshToken(): RefreshToken {
  const token = randomBytes(refreshTokenBytes).toString('base64url');

  return { token, hash: hashRefreshToken(token) };
}

function sessionExpiry(from: Date): Date {
  return new Date(from.getTime() + sessionLifetimeDays * millisecondsPerDay);
}

/** Sessions: one per sign-in. Each holds a refresh token that is replaced on every use. */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async start(
    userId: string,
    signInMethod: SignInMethod,
    database: DatabaseClient,
  ): Promise<AuthTokens> {
    const refreshToken = createRefreshToken();
    const session = await database.session.create({
      data: {
        userId,
        signInMethod,
        refreshTokenHash: refreshToken.hash,
        expiresAt: sessionExpiry(new Date()),
      },
    });

    return this.tokens(userId, session.id, refreshToken.token);
  }

  /** Exchanges a refresh token for a new pair of tokens. The old refresh token stops working. */
  async refresh(token: string): Promise<AuthTokens> {
    const hash = hashRefreshToken(token);
    const now = new Date();
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
      include: { user: { select: { status: true } } },
    });

    if (!session) {
      // A token that was already replaced came back: it was copied. End that session for everyone.
      await this.prisma.session.updateMany({
        where: { previousRefreshTokenHash: hash, revokedAt: null },
        data: { revokedAt: now },
      });

      throw invalidRefreshToken();
    }

    if (session.revokedAt || session.expiresAt <= now) {
      throw invalidRefreshToken();
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw accountBlocked();
    }

    const next = createRefreshToken();
    // The old hash in the condition makes sure only one of two parallel requests wins.
    const { count } = await this.prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: hash, revokedAt: null },
      data: {
        refreshTokenHash: next.hash,
        previousRefreshTokenHash: hash,
        expiresAt: sessionExpiry(now),
      },
    });

    if (count !== 1) {
      throw invalidRefreshToken();
    }

    return this.tokens(session.userId, session.id, next.token);
  }

  async end(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Ends every session of the user, on all devices. One session can be kept. */
  async endAll(userId: string, database: DatabaseClient, keepSessionId?: string): Promise<void> {
    await database.session.updateMany({
      where: { userId, revokedAt: null, id: { not: keepSessionId } },
      data: { revokedAt: new Date() },
    });
  }

  private async tokens(
    userId: string,
    sessionId: string,
    refreshToken: string,
  ): Promise<AuthTokens> {
    return {
      accessToken: await this.accessTokens.sign({ userId, sessionId }),
      expiresInSeconds: accessTokenLifetimeSeconds,
      refreshToken,
    };
  }
}
