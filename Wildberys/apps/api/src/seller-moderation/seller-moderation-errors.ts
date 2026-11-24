import { HttpStatus } from '@nestjs/common';

import { AppException } from '../errors/app.exception.js';

export function sellerNotFound(): AppException {
  return new AppException(HttpStatus.NOT_FOUND, 'SELLER_NOT_FOUND', 'No seller with this id');
}

/** The decision does not fit the status the seller is in now: somebody else decided first, or the seller is not in the check. */
export function sellerStatusConflict(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'SELLER_STATUS_CONFLICT',
    'The seller is not in a status this decision can be made in',
  );
}

/** Only a registration nobody sent can be deleted. */
export function sellerNotDraft(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'SELLER_NOT_DRAFT',
    'Only a registration that was not sent can be deleted',
  );
}
