import { describe, expect, it } from 'vitest';

import { loadAppConfig } from './app-config.js';

const validEnv = {
  PORT: '4000',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/database',
  LOG_FORMAT: 'json',
  CORS_ORIGINS: 'http://localhost:3000, http://localhost:3001',
  API_DOCS_ENABLED: 'false',
  ACCESS_TOKEN_SECRET: 'access-token-secret-of-32-characters',
  ONE_TIME_CODE_SECRET: 'one-time-code-secret-of-32-characters',
  SMTP_URL: 'smtp://localhost:1025',
  MAIL_FROM: 'Bluberi <no-reply@bluberi.cz>',
  STORAGE_ENDPOINT: 'http://localhost:9100',
  STORAGE_REGION: 'us-east-1',
  STORAGE_ACCESS_KEY: 'access-key',
  STORAGE_SECRET_KEY: 'secret-key',
  STORAGE_BUCKET: 'bluberi',
  STORAGE_PRIVATE_BUCKET: 'bluberi-private',
  STORAGE_PUBLIC_URL: 'http://localhost:9100/bluberi',
  ARES_URL: 'https://ares.example/rest',
  VIES_URL: 'https://vies.example/rest-api',
  REDIS_URL: 'redis://localhost:6379',
  REDIS_NAMESPACE: 'bluberi',
};

describe('loadAppConfig', () => {
  it('reads and converts every setting', () => {
    expect(loadAppConfig(validEnv)).toEqual({
      port: 4000,
      databaseUrl: 'postgresql://user:password@localhost:5432/database',
      logFormat: 'json',
      corsOrigins: ['http://localhost:3000', 'http://localhost:3001'],
      apiDocsEnabled: false,
      accessTokenSecret: 'access-token-secret-of-32-characters',
      oneTimeCodeSecret: 'one-time-code-secret-of-32-characters',
      smtpUrl: 'smtp://localhost:1025',
      mailFrom: 'Bluberi <no-reply@bluberi.cz>',
      storageEndpoint: 'http://localhost:9100',
      storageRegion: 'us-east-1',
      storageAccessKey: 'access-key',
      storageSecretKey: 'secret-key',
      storageBucket: 'bluberi',
      storagePrivateBucket: 'bluberi-private',
      storagePublicUrl: 'http://localhost:9100/bluberi',
      aresUrl: 'https://ares.example/rest',
      viesUrl: 'https://vies.example/rest-api',
      redisUrl: 'redis://localhost:6379',
      redisNamespace: 'bluberi',
    });
  });

  it('refuses to start without a setting', () => {
    expect(() => loadAppConfig({})).toThrow(/Invalid environment variables/);
  });

  it.each([
    ['PORT', 'not-a-number', /port/],
    ['PORT', '70000', /port/],
    ['DATABASE_URL', '', /databaseUrl/],
    ['LOG_FORMAT', 'xml', /logFormat/],
    ['CORS_ORIGINS', 'not a url', /corsOrigins/],
    ['CORS_ORIGINS', '', /corsOrigins/],
    ['API_DOCS_ENABLED', 'yes', /apiDocsEnabled/],
    ['ACCESS_TOKEN_SECRET', 'too-short', /accessTokenSecret/],
    ['ONE_TIME_CODE_SECRET', 'too-short', /oneTimeCodeSecret/],
    ['SMTP_URL', 'http://localhost:1025', /smtpUrl/],
    ['MAIL_FROM', '', /mailFrom/],
    ['STORAGE_ENDPOINT', 'localhost:9100', /storageEndpoint/],
    ['STORAGE_REGION', '', /storageRegion/],
    ['STORAGE_ACCESS_KEY', '', /storageAccessKey/],
    ['STORAGE_SECRET_KEY', '', /storageSecretKey/],
    ['STORAGE_BUCKET', '', /storageBucket/],
    ['STORAGE_PRIVATE_BUCKET', '', /storagePrivateBucket/],
    ['STORAGE_PUBLIC_URL', 'not a url', /storagePublicUrl/],
    ['STORAGE_PUBLIC_URL', 'http://localhost:9100/bluberi/', /storagePublicUrl/],
    ['ARES_URL', 'ares.example', /aresUrl/],
    ['ARES_URL', 'https://ares.example/rest/', /aresUrl/],
    ['VIES_URL', 'vies.example', /viesUrl/],
    ['VIES_URL', 'https://vies.example/rest-api/', /viesUrl/],
    ['REDIS_URL', 'http://localhost:6379', /redisUrl/],
    ['REDIS_URL', 'localhost:6379', /redisUrl/],
    ['REDIS_NAMESPACE', '', /redisNamespace/],
    ['REDIS_NAMESPACE', 'Bluberi test', /redisNamespace/],
  ])('refuses %s=%s', (name, value, message) => {
    expect(() => loadAppConfig({ ...validEnv, [name]: value })).toThrow(message);
  });
});
