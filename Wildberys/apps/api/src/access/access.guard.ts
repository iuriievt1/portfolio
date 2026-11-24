import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { getAuthContext } from '../auth/auth-context.js';
import type { SellerMemberRole } from '../generated/prisma/enums.js';
import { forbidden } from './access-errors.js';
import {
  RequirePlatformAccess,
  RequireSellerRole,
  type PlatformAccessRequirement,
} from './access.decorators.js';
import { hasPlatformAccess } from './platform-access.js';

/** Runs after AuthGuard. Checks the roles a route asks for. */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const platformAccess = this.reflector.getAllAndOverride<
      PlatformAccessRequirement | readonly PlatformAccessRequirement[] | undefined
    >(RequirePlatformAccess, targets);
    const sellerRoles = this.reflector.getAllAndOverride<readonly SellerMemberRole[] | undefined>(
      RequireSellerRole,
      targets,
    );

    if (!platformAccess && !sellerRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const auth = getAuthContext(request);

    if (
      platformAccess &&
      ![platformAccess]
        .flat()
        .some(({ area, level }) => hasPlatformAccess(auth.platformRoles, area, level))
    ) {
      throw forbidden();
    }

    if (sellerRoles) {
      // The same answer for a seller that does not exist and for one the user does not work for.
      const membership = auth.sellerMemberships.find(
        ({ sellerId }) => sellerId === request.params.sellerId,
      );

      if (!membership || !sellerRoles.includes(membership.role)) {
        throw forbidden();
      }
    }

    return true;
  }
}
