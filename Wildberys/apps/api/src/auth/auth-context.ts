import type { Request } from 'express';

import type { PlatformRole, SellerMemberRole, SignInMethod } from '../generated/prisma/enums.js';

export interface SellerMembership {
  readonly sellerId: string;
  readonly role: SellerMemberRole;
}

/** Who makes the request. Read from the database on every request, so a removed role stops working at once. */
export interface AuthContext {
  readonly userId: string;
  readonly sessionId: string;
  /** When the access token of the request stops working. Nothing opened with it lives longer. */
  readonly accessExpiresAt: Date;
  readonly signInMethod: SignInMethod;
  readonly signedInAt: Date;
  readonly platformRoles: readonly PlatformRole[];
  readonly sellerMemberships: readonly SellerMembership[];
}

const authContexts = new WeakMap<Request, AuthContext>();

export function setAuthContext(request: Request, context: AuthContext): void {
  authContexts.set(request, context);
}

export function getAuthContext(request: Request): AuthContext {
  const context = authContexts.get(request);

  if (!context) {
    throw new Error('No signed-in user: the route is public or the auth guard did not run');
  }

  return context;
}
