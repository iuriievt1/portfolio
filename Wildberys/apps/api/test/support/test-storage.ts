import { DeleteObjectsCommand, ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';

import { loadAppConfig } from '../../src/config/app-config.js';
import { ensurePrivateBucket } from '../../src/storage/ensure-private-bucket.js';
import { ensurePublicBucket } from '../../src/storage/ensure-public-bucket.js';
import { createS3Client } from '../../src/storage/s3-client.js';

async function emptyBucket(client: S3Client, bucket: string): Promise<void> {
  for (;;) {
    const { Contents: files = [] } = await client.send(
      new ListObjectsV2Command({ Bucket: bucket }),
    );

    if (files.length === 0) {
      return;
    }

    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: files.map(({ Key }) => ({ Key })) },
      }),
    );
  }
}

/** Creates the test buckets when they are missing and removes every file the tests left in them. */
export async function prepareTestBucket(): Promise<void> {
  const config = loadAppConfig(process.env);

  await ensurePublicBucket(config);
  await ensurePrivateBucket(config);

  const client = createS3Client(config);

  try {
    await emptyBucket(client, config.storageBucket);
    await emptyBucket(client, config.storagePrivateBucket);
  } finally {
    client.destroy();
  }
}
