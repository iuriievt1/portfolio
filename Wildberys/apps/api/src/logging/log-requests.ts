import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { requestIdHeader } from './request-id.js';

const logger = new Logger('Request');

/** Gives every request an id, returns it in a header and logs the request when it ends. */
export function logRequests(request: Request, response: Response, next: NextFunction): void {
  const requestId = randomUUID();
  const startedAt = performance.now();

  response.setHeader(requestIdHeader, requestId);

  response.on('finish', () => {
    logger.log('Request completed', {
      requestId,
      method: request.method,
      // Without the query string: it can hold personal data.
      path: request.path,
      statusCode: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
    });
  });

  next();
}
