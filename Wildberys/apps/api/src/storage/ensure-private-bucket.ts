import { CreateBucketCommand } from '@aws-sdk/client-s3';

import type { AppConfig } from '../config/app-config.js';
import { createS3Client } from './s3-client.js';

/**
 * Creates the bucket for files only the API reads when it is missing. It gets no policy,
 * so nothing in it can be read by an address. Safe to run again.
 * Used for local development and tests. In production the bucket is prepared by hand.
 */
export async function ensurePrivateBucket(config: AppConfig): Promise<void> {
  const client = createS3Client(config);

  try {
    await client.send(new CreateBucketCommand({ Bucket: config.storagePrivateBucket }));
  } finally {
    client.destroy();
  }
}
