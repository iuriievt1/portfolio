import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

import { getRequestId } from '../logging/request-id.js';
import type { ApiError } from './api-error.dto.js';
import { AppException } from './app.exception.js';

/** Turns every thrown error into the same response shape, see ApiError. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Error');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = getRequestId(response);
    const error = this.toApiError(exception, requestId);

    if (error.statusCode >= 500) {
      this.logger.error('Request failed', { requestId, error: exception });
    }

    response.status(error.statusCode).json(error);
  }

  private toApiError(exception: unknown, requestId: string): ApiError {
    if (exception instanceof AppException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        requestId,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();

      return {
        statusCode,
        code: HttpStatus[statusCode] ?? 'HTTP_ERROR',
        message: exception.message,
        requestId,
      };
    }

    // Anything else is a bug. The details go to the log, not to the client.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong on our side',
      requestId,
    };
  }
}
