import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';

import { AppConfig } from '../config/app-config.js';
import type { FileToStore } from './file-storage.js';
import { PrivateFileStorage } from './private-file-storage.js';
import { createS3Client } from './s3-client.js';

@Injectable()
export class S3PrivateFileStorage extends PrivateFileStorage implements OnModuleDestroy {
  private readonly client: S3Client;

  constructor(private readonly config: AppConfig) {
    super();
    this.client = createS3Client(config);
  }

  async put({ key, body, contentType }: FileToStore): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.storagePrivateBucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const { Body: body } = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.storagePrivateBucket, Key: key }),
    );

    if (!body) {
      throw new Error(`The storage answered without a file for the key ${key}`);
    }

    return Buffer.from(await body.transformToByteArray());
  }

  async remove(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.storagePrivateBucket, Key: key }),
    );
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }
}
