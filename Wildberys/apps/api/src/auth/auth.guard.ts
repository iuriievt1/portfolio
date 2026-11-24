import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { PrismaService } from '../database/prisma.service.js';
import { UserStatus } from '../generated/prisma/enums.js';
import { AccessTokenService } from './access-token.service.js';
import { setAuthContext } from './auth-context.js';
import { accountBlocked, unauthenticated } from './auth-errors.js';
import { publicRouteKey } from './public.decorator.js';

const bearerPrefix = 'Bearer ';

/** Runs for every route. Lets a request through only with a valid access token, unless the route is public. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(publicRouteKey, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;

    if (!header?.startsWith(bearerPrefix)) {
      throw unauthenticated();
    }

    const claims = await this.accessTokens.verify(header.slice(bearerPrefix.length));

    if (!claims) {
      throw unauthenticated();
    }

    // The token only says who it was given to. Whether the session still stands
    // and what the user may do is read from the database every time.
    const session = await this.prisma.session.findUnique({
      where: { id: claims.sessionId },
      include: { user: { include: { platformRoles: true, sellerMemberships: true } } },
    });

    if (
      !session ||
      session.userId !== claims.userId ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw unauthenticated();
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw accountBlocked();
    }

    setAuthContext(request, {
      userId: session.userId,
      sessionId: session.id,
      accessExpiresAt: claims.expiresAt,
      signInMethod: session.signInMethod,
      signedInAt: session.createdAt,
      platformRoles: session.user.platformRoles.map(({ role }) => role),
      sellerMemberships: session.user.sellerMemberships.map(({ sellerId, role }) => ({
        sellerId,
        role,
      })),
    });

    return true;
  }
}
