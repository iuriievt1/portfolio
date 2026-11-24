import { loadAppConfig } from '../config/app-config.js';
import { ensurePrivateBucket } from '../storage/ensure-private-bucket.js';
import { ensurePublicBucket } from '../storage/ensure-public-bucket.js';

// Prepares the local S3 storage: the bucket for photos, with its files open for reading,
// and the closed bucket for the documents of sellers.
const config = loadAppConfig(process.env);

await ensurePublicBucket(config);
await ensurePrivateBucket(config);

process.stdout.write(
  `The buckets "${config.storageBucket}" and "${config.storagePrivateBucket}" are ready at ${config.storageEndpoint}\n`,
);
