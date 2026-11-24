import { Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';

import { AppConfig } from '../config/app-config.js';
import { accessTokenLifetimeSeconds } from './auth-policy.js';
import { tokenAlgorithm, tokenIssuer, tokenKey } from './token-signing.js';

/** Who an access token is given to. */
export interface AccessTokenOwner {
  readonly userId: string;
  readonly sessionId: string;
}

export interface AccessTokenClaims extends AccessTokenOwner {
  /** When the token stops working. */
  readonly expiresAt: Date;
}

/** Signs and checks access tokens: short-lived JWTs that name the user and the session. */
@Injectable()
export class AccessTokenService {
  private readonly key: Uint8Array;

  constructor(config: AppConfig) {
    this.key = tokenKey(config);
  }

  sign(owner: AccessTokenOwner): Promise<string> {
    return new SignJWT({ sid: owner.sessionId })
      .setProtectedHeader({ alg: tokenAlgorithm })
      .setIssuer(tokenIssuer)
      .setSubject(owner.userId)
      .setIssuedAt()
      .setExpirationTime(`${String(accessTokenLifetimeSeconds)}s`)
      .sign(this.key);
  }

  /** Returns nothing when the token is forged, expired, without an end or not ours. */
  async verify(token: string): Promise<AccessTokenClaims | undefined> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [tokenAlgorithm],
        issuer: tokenIssuer,
      });

      if (
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string' ||
        typeof payload.exp !== 'number'
      ) {
        return undefined;
      }

      return {
        userId: payload.sub,
        sessionId: payload.sid,
        expiresAt: new Date(payload.exp * 1000),
      };
    } catch {
      return undefined;
    }
  }
}
