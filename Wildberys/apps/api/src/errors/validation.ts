import { HttpStatus, ValidationPipe, type ValidationError } from '@nestjs/common';

import type { ApiErrorDetail } from './api-error.dto.js';
import { AppException } from './app.exception.js';

function toDetails(errors: ValidationError[], parentPath = ''): ApiErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({ field, message }));

    return [...own, ...toDetails(error.children ?? [], field)];
  });
}

/** Checks request bodies, queries and params against their DTO classes. Unknown fields are an error. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'The request is not valid',
        toDetails(errors),
      ),
  });
}
