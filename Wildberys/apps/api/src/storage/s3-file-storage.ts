import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';

import { AppConfig } from '../config/app-config.js';
import { FileStorage, type FileToStore } from './file-storage.js';
import { createS3Client } from './s3-client.js';

// A key is written once, so browsers and the CDN may keep the file forever.
const cacheForever = 'public, max-age=31536000, immutable';

@Injectable()
export class S3FileStorage extends FileStorage implements OnModuleDestroy {
  private readonly client: S3Client;

  constructor(private readonly config: AppConfig) {
    super();
    this.client = createS3Client(config);
  }

  async put({ key, body, contentType }: FileToStore): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.storageBucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheForever,
      }),
    );
  }

  publicUrl(key: string): string {
    return `${this.config.storagePublicUrl}/${key}`;
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }
}
