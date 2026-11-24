import { HttpStatus } from '@nestjs/common';

import { AppException } from '../errors/app.exception.js';

/** The user is signed in but their roles do not allow the action. */
export function forbidden(): AppException {
  return new AppException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'You are not allowed to do this');
}

/** A role can only be given to a person who already has an account. */
export function userNotFound(): AppException {
  return new AppException(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', 'No account with this email');
}
