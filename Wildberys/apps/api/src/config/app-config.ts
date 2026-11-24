import { plainToInstance } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const logFormats = ['json', 'pretty'] as const;
const secretMinLength = 32;

/** The settings the API reads from environment variables. All of them are required. */
export class AppConfig {
  /** PORT */
  @IsInt()
  @Min(1)
  @Max(65535)
  readonly port!: number;

  /** DATABASE_URL */
  @IsString()
  @IsNotEmpty()
  readonly databaseUrl!: string;

  /** LOG_FORMAT: "json" for machines, "pretty" for a terminal. */
  @IsIn(logFormats)
  readonly logFormat!: (typeof logFormats)[number];

  /** CORS_ORIGINS: addresses of the web apps that may call the API, separated by commas. */
  @ArrayNotEmpty()
  @IsUrl({ require_tld: false }, { each: true })
  readonly corsOrigins!: string[];

  /** API_DOCS_ENABLED: serve the OpenAPI document and Swagger UI under /docs. */
  @IsBoolean()
  readonly apiDocsEnabled!: boolean;

  /** ACCESS_TOKEN_SECRET: the key that signs access tokens. */
  @IsString()
  @MinLength(secretMinLength)
  readonly accessTokenSecret!: string;

  /** ONE_TIME_CODE_SECRET: the key that hashes one-time codes. */
  @IsString()
  @MinLength(secretMinLength)
  readonly oneTimeCodeSecret!: string;

  /** SMTP_URL: the mail server, for example smtp://localhost:1025. */
  @IsUrl({ protocols: ['smtp', 'smtps'], require_protocol: true, require_tld: false })
  readonly smtpUrl!: string;

  /** MAIL_FROM: the sender of outgoing emails. */
  @IsString()
  @IsNotEmpty()
  readonly mailFrom!: string;

  /** STORAGE_ENDPOINT: the S3 storage for files, for example http://localhost:9100. */
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  readonly storageEndpoint!: string;

  /** STORAGE_REGION */
  @IsString()
  @IsNotEmpty()
  readonly storageRegion!: string;

  /** STORAGE_ACCESS_KEY */
  @IsString()
  @IsNotEmpty()
  readonly storageAccessKey!: string;

  /** STORAGE_SECRET_KEY */
  @IsString()
  @IsNotEmpty()
  readonly storageSecretKey!: string;

  /** STORAGE_BUCKET: the bucket the API writes files to. */
  @IsString()
  @IsNotEmpty()
  readonly storageBucket!: string;

  /** STORAGE_PRIVATE_BUCKET: the bucket for files only the API reads, like the documents of sellers. */
  @IsString()
  @IsNotEmpty()
  readonly storagePrivateBucket!: string;

  /** STORAGE_PUBLIC_URL: the address files are read from, without a slash at the end. */
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @Matches(/[^/]$/)
  readonly storagePublicUrl!: string;

  /** ARES_URL: the Czech register of companies, without a slash at the end. */
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @Matches(/[^/]$/)
  readonly aresUrl!: string;

  /** VIES_URL: the register of VAT numbers of the EU, without a slash at the end. */
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @Matches(/[^/]$/)
  readonly viesUrl!: string;

  /** REDIS_URL: the Redis server, for example redis://localhost:6379. */
  @IsUrl({ protocols: ['redis', 'rediss'], require_protocol: true, require_tld: false })
  readonly redisUrl!: string;

  /** REDIS_NAMESPACE: the word in front of everything the API names in Redis. */
  @Matches(/^[a-z][a-z0-9-]*$/)
  readonly redisNamespace!: string;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** Reads the settings and stops the start with a clear message when one is missing or wrong. */
export function loadAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const config = plainToInstance(AppConfig, {
    port: Number(env.PORT),
    databaseUrl: env.DATABASE_URL,
    logFormat: env.LOG_FORMAT,
    corsOrigins: parseList(env.CORS_ORIGINS),
    apiDocsEnabled: parseBoolean(env.API_DOCS_ENABLED),
    accessTokenSecret: env.ACCESS_TOKEN_SECRET,
    oneTimeCodeSecret: env.ONE_TIME_CODE_SECRET,
    smtpUrl: env.SMTP_URL,
    mailFrom: env.MAIL_FROM,
    storageEndpoint: env.STORAGE_ENDPOINT,
    storageRegion: env.STORAGE_REGION,
    storageAccessKey: env.STORAGE_ACCESS_KEY,
    storageSecretKey: env.STORAGE_SECRET_KEY,
    storageBucket: env.STORAGE_BUCKET,
    storagePrivateBucket: env.STORAGE_PRIVATE_BUCKET,
    storagePublicUrl: env.STORAGE_PUBLIC_URL,
    aresUrl: env.ARES_URL,
    viesUrl: env.VIES_URL,
    redisUrl: env.REDIS_URL,
    redisNamespace: env.REDIS_NAMESPACE,
  });

  const problems = validateSync(config).flatMap((error) => Object.values(error.constraints ?? {}));

  if (problems.length > 0) {
    throw new Error(
      `Invalid environment variables: ${problems.join('; ')}. See apps/api/.env.example`,
    );
  }

  return config;
}
