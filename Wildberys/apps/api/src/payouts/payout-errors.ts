import { HttpStatus } from '@nestjs/common';

import { AppException } from '../errors/app.exception.js';

/** The seller has not said yet how they want to be paid. */
export function payoutMethodRequired(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'PAYOUT_METHOD_REQUIRED',
    'Choose how to be paid first: Stripe or a bank account',
  );
}

/** A bank account is kept only for a seller who chose to be paid to a bank account. */
export function payoutMethodNotBank(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'PAYOUT_METHOD_NOT_BANK',
    'This seller is paid through their Stripe account and looks after the bank account there',
  );
}

/** The check of the provider cannot start before the bank account is given. */
export function bankAccountRequired(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'BANK_ACCOUNT_REQUIRED',
    'Save the bank account first',
  );
}
