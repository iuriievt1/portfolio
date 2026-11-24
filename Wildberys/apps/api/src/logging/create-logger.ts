import { ConsoleLogger } from '@nestjs/common';

import type { AppConfig } from '../config/app-config.js';

/** Fields that must never appear in the logs, whatever object they are part of. */
const redactedFields = ['password', 'passwordHash', 'authorization', 'cookie', 'token'];

export function createLogger(logFormat: AppConfig['logFormat']): ConsoleLogger {
  return new ConsoleLogger({
    json: logFormat === 'json',
    flattenParams: true,
    redact: redactedFields,
  });
}
