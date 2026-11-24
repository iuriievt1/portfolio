import { Reflector } from '@nestjs/core';

import type { SellerMemberRole } from '../generated/prisma/enums.js';
import type { AccessLevel, PlatformArea } from './platform-access.js';

export interface PlatformAccessRequirement {
  readonly area: PlatformArea;
  readonly level: Exclude<AccessLevel, 'none'>;
}

/**
 * The route is for the Bluberi team: the user needs this level of access to this section of the admin.
 * A route that belongs to several sections lists them all, and access to any one of them is enough.
 */
export const RequirePlatformAccess = Reflector.createDecorator<
  PlatformAccessRequirement | readonly PlatformAccessRequirement[]
>();

/** The route has :sellerId in its path: the user must work for that seller in one of these roles. */
export const RequireSellerRole = Reflector.createDecorator<readonly SellerMemberRole[]>();
