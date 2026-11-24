import { execFileSync } from 'node:child_process';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';
import { applyTestEnv } from './support/test-env.js';
import { prepareTestBucket } from './support/test-storage.js';

async function prepareTestDatabase(): Promise<void> {
  const { testDatabaseUrl, maintenanceDatabaseUrl, testDatabaseName } = applyTestEnv();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: maintenanceDatabaseUrl }),
  });

  try {
    const existing = await prisma.$queryRaw<unknown[]>`
      SELECT 1 FROM pg_database WHERE datname = ${testDatabaseName}
    `;

    if (existing.length === 0) {
      // The name is a constant from the test code, not user input.
      await prisma.$executeRawUnsafe(`CREATE DATABASE "${testDatabaseName}"`);
    }
  } catch (cause) {
    throw new Error('The tests need PostgreSQL. Start it with: pnpm services:up', { cause });
  } finally {
    await prisma.$disconnect();
  }

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'pipe',
  });
}

async function prepareTestStorage(): Promise<void> {
  try {
    await prepareTestBucket();
  } catch (cause) {
    throw new Error('The tests need the file storage. Start it with: pnpm services:up', { cause });
  }
}

/**
 * Runs once before all tests: creates the test database and the test bucket when they are missing,
 * applies the migrations and empties the bucket. The returned function empties the bucket again at the end.
 */
export default async function setup(): Promise<() => Promise<void>> {
  await prepareTestDatabase();
  await prepareTestStorage();

  return prepareTestBucket;
}
