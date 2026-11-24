import { VersioningType, type INestApplication } from '@nestjs/common';

import { AppConfig } from './config/app-config.js';
import { AllExceptionsFilter } from './errors/all-exceptions.filter.js';
import { createValidationPipe } from './errors/validation.js';
import { logRequests } from './logging/log-requests.js';

/** Everything that is the same for the running API, the tests and the OpenAPI export. */
export function configureApp(app: INestApplication): void {
  const config = app.get(AppConfig);

  // Goes first, before the body is parsed, so a request with a broken body gets an id too.
  app.use(logRequests);
  // Routes live under /v1, /v2 and so on. Health checks have no version.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: config.corsOrigins });
}
