import { writeFile } from 'node:fs/promises';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module.js';
import { configureApp } from '../configure-app.js';
import { createOpenApiDocument } from './openapi.js';

// Writes the OpenAPI document to the file given as the first argument.
// The database is not needed: the client connects only on the first query.
const outputPath = process.argv[2];

if (!outputPath) {
  throw new Error('Usage: write-openapi <output file>');
}

const app = await NestFactory.create(AppModule, { logger: false });
configureApp(app);

await writeFile(outputPath, `${JSON.stringify(createOpenApiDocument(app), null, 2)}\n`);
await app.close();
