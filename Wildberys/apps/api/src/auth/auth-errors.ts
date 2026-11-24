import { HttpStatus } from '@nestjs/common';

import { AppException } from '../errors/app.exception.js';

/** No access token, or it is forged, expired or belongs to a session that has ended. */
export function unauthenticated(): AppException {
  return new AppException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Sign in to continue');
}

export function accountBlocked(): AppException {
  return new AppException(HttpStatus.FORBIDDEN, 'ACCOUNT_BLOCKED', 'This account is blocked');
}

/** The same answer for an unknown email, an account without a password and a wrong password. */
export function invalidCredentials(): AppException {
  return new AppException(
    HttpStatus.UNAUTHORIZED,
    'INVALID_CREDENTIALS',
    'The email or the password is wrong',
  );
}

/** The password step was too long ago, or its token is not ours. */
export function signInConfirmationExpired(): AppException {
  return new AppException(
    HttpStatus.UNAUTHORIZED,
    'SIGN_IN_CONFIRMATION_EXPIRED',
    'Enter the password again',
  );
}

export function invalidRefreshToken(): AppException {
  return new AppException(
    HttpStatus.UNAUTHORIZED,
    'INVALID_REFRESH_TOKEN',
    'The session has ended, sign in again',
  );
}

/** The same answer for a wrong, used and expired code, and for too many attempts. */
export function invalidOneTimeCode(): AppException {
  return new AppException(
    HttpStatus.BAD_REQUEST,
    'ONE_TIME_CODE_INVALID',
    'The code is wrong or no longer valid',
  );
}
