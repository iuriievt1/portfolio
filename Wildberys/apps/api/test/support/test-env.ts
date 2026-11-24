import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const testDatabaseName = 'bluberi_test';
const testBucket = 'bluberi-test';
const testPrivateBucket = 'bluberi-test-private';
const testRedisNamespace = 'bluberi-test';

export interface TestEnv {
  /** The database the tests write to. They never touch the development database. */
  readonly testDatabaseUrl: string;
  /** The database every PostgreSQL server has. Used only to create the test database. */
  readonly maintenanceDatabaseUrl: string;
  readonly testDatabaseName: string;
}

function withDatabase(url: string, database: string): string {
  const result = new URL(url);

  result.pathname = `/${database}`;

  return result.toString();
}

function required(template: NodeJS.Dict<string>, name: string): string {
  const value = template[name];

  if (!value) {
    throw new Error(`${name} is missing in apps/api/.env.example`);
  }

  return value;
}

/**
 * Tests use the settings of a fresh checkout (.env.example), not the developer's own .env,
 * with three changes: the database, the storage buckets and the names in Redis are separate ones.
 */
export function applyTestEnv(): TestEnv {
  const template = parseEnv(readFileSync('.env.example', 'utf8'));
  const developmentDatabaseUrl = required(template, 'DATABASE_URL');
  const testDatabaseUrl = withDatabase(developmentDatabaseUrl, testDatabaseName);

  Object.assign(process.env, template, {
    DATABASE_URL: testDatabaseUrl,
    STORAGE_BUCKET: testBucket,
    STORAGE_PRIVATE_BUCKET: testPrivateBucket,
    REDIS_NAMESPACE: testRedisNamespace,
    STORAGE_PUBLIC_URL: `${required(template, 'STORAGE_ENDPOINT')}/${testBucket}`,
  });

  return {
    testDatabaseUrl,
    maintenanceDatabaseUrl: withDatabase(developmentDatabaseUrl, 'postgres'),
    testDatabaseName,
  };
}
