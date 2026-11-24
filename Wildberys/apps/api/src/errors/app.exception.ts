import { HttpException, type HttpExceptionOptions, type HttpStatus } from '@nestjs/common';

import type { ApiErrorDetail } from './api-error.dto.js';

/** An error with a stable code. Throw it for every failure the API reports on purpose. */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    message: string,
    readonly details?: ApiErrorDetail[],
    options?: HttpExceptionOptions,
  ) {
    super(message, status, options);
  }
}
