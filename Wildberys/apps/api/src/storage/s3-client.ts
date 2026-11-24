import { S3Client } from '@aws-sdk/client-s3';

import type { AppConfig } from '../config/app-config.js';

/** A client for the S3 storage from the settings: RustFS locally, Cloudflare R2 in production. */
export function createS3Client(config: AppConfig): S3Client {
  return new S3Client({
    endpoint: config.storageEndpoint,
    region: config.storageRegion,
    // The bucket is part of the path, not of the host name. RustFS needs it and R2 accepts it.
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.storageAccessKey,
      secretAccessKey: config.storageSecretKey,
    },
  });
}
