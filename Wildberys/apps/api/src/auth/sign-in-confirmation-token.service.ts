import { Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';

import { AppConfig } from '../config/app-config.js';
import { signInConfirmationMinutes } from './auth-policy.js';
import { signInApps, type SignInApp } from './auth.dto.js';
import { tokenAlgorithm, tokenIssuer, tokenKey } from './token-signing.js';

/** Tells this token from an access token: each kind is refused where the other is expected. */
const audience = 'sign-in-confirmation';

/** Who may finish a sign-in with a code, and in which app they started it. */
export interface SignInToConfirm {
  readonly userId: string;
  readonly app: SignInApp;
}

/**
 * Signs and checks the token a right password gives. It names the user who may finish
 * the sign-in with a code and the app they sign in to, so a code sent again names the same app.
 * It is not an access token and opens no route.
 */
@Injectable()
export class SignInConfirmationTokenService {
  private readonly key: Uint8Array;

  constructor(config: AppConfig) {
    this.key = tokenKey(config);
  }

  sign({ userId, app }: SignInToConfirm): Promise<string> {
    return new SignJWT({ app })
      .setProtectedHeader({ alg: tokenAlgorithm })
      .setIssuer(tokenIssuer)
      .setAudience(audience)
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(`${String(signInConfirmationMinutes)}m`)
      .sign(this.key);
  }

  /** Returns what the token says, or nothing when it is forged, expired or of another kind. */
  async verify(token: string): Promise<SignInToConfirm | undefined> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [tokenAlgorithm],
        issuer: tokenIssuer,
        audience,
      });

      const app = signInApps.find((known) => known === payload.app);

      return payload.sub !== undefined && app !== undefined
        ? { userId: payload.sub, app }
        : undefined;
    } catch {
      return undefined;
    }
  }
}
