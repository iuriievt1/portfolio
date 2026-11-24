import { HttpStatus } from '@nestjs/common';

import { AppException } from '../errors/app.exception.js';

/** The register says this VAT number is not valid in this country. */
export function vatNumberNotFound(): AppException {
  return new AppException(
    HttpStatus.NOT_FOUND,
    'VAT_NUMBER_NOT_FOUND',
    'The register has no valid VAT number like this in this country',
  );
}

/** The register, or the country it asked, did not answer or answered with something that cannot be read. */
export function vatRegistryUnavailable(cause?: unknown): AppException {
  return new AppException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'VAT_REGISTRY_UNAVAILABLE',
    'The register of VAT numbers does not answer, try again later',
    undefined,
    { cause },
  );
}
