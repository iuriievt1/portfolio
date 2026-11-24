import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { AppConfig } from './config/app-config.js';
import { configureApp } from './configure-app.js';
import { createLogger } from './logging/create-logger.js';
import { serveOpenApiDocs } from './openapi/openapi.js';

// Log lines are kept until the config is read and the logger knows its format.
const app = await NestFactory.create(AppModule, { bufferLogs: true });
const config = app.get(AppConfig);

app.useLogger(createLogger(config.logFormat));
configureApp(app);
// Close the database connection when the process is asked to stop.
app.enableShutdownHooks();

if (config.apiDocsEnabled) {
  serveOpenApiDocs(app);
}

await app.listen(config.port);
