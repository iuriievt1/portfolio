import { existsSync } from 'node:fs';

import { defineConfig } from 'prisma/config';

// Prisma does not read .env on its own. CI has no .env and only runs commands that need no database.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
