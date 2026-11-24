import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module.js';
import { ImageProcessor } from './image-processor.js';
import { ImagesController } from './images.controller.js';
import { ImagesService } from './images.service.js';

@Module({
  imports: [StorageModule],
  controllers: [ImagesController],
  providers: [ImageProcessor, ImagesService],
})
export class ImagesModule {}
