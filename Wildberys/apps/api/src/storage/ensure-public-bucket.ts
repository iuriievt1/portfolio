import { CreateBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';

import type { AppConfig } from '../config/app-config.js';
import { createS3Client } from './s3-client.js';

/**
 * Creates the bucket from the settings when it is missing and lets everyone read its files
 * by address. Listing the bucket stays closed. Safe to run again.
 * Used for local development and tests. In production the bucket is prepared by hand.
 */
export async function ensurePublicBucket(config: AppConfig): Promise<void> {
  const client = createS3Client(config);
  const bucket = config.storageBucket;

  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    await client.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        }),
      }),
    );
  } finally {
    client.destroy();
  }
}
