import { HttpStatus } from '@nestjs/common';

import { AppException } from '../errors/app.exception.js';

/** The register has no company with this number. */
export function companyNotFound(): AppException {
  return new AppException(
    HttpStatus.NOT_FOUND,
    'COMPANY_NOT_FOUND',
    'The register has no company with this number',
  );
}

/** The company was closed, so it cannot sell. */
export function companyNotActive(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'COMPANY_NOT_ACTIVE',
    'The register says this company no longer exists',
  );
}

/** The register did not answer, or answered with something that cannot be read. */
export function companyRegistryUnavailable(cause?: unknown): AppException {
  return new AppException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'COMPANY_REGISTRY_UNAVAILABLE',
    'The register of companies does not answer, try again later',
    undefined,
    { cause },
  );
}
