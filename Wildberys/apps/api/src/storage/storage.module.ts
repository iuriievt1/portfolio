import { Module } from '@nestjs/common';

import { FileStorage } from './file-storage.js';
import { PrivateFileStorage } from './private-file-storage.js';
import { S3FileStorage } from './s3-file-storage.js';
import { S3PrivateFileStorage } from './s3-private-file-storage.js';

@Module({
  providers: [
    { provide: FileStorage, useClass: S3FileStorage },
    { provide: PrivateFileStorage, useClass: S3PrivateFileStorage },
  ],
  exports: [FileStorage, PrivateFileStorage],
})
export class StorageModule {}
