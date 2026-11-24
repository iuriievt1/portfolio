import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { FileStorage } from '../storage/file-storage.js';
import { ImageProcessor } from './image-processor.js';
import type { UploadedImage } from './images.dto.js';

const contentType = 'image/webp';

/** Where a copy of a photo is kept in the storage. */
export function imageKey(imageId: string, width: number): string {
  return `images/${imageId}/${String(width)}.webp`;
}

@Injectable()
export class ImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: ImageProcessor,
    private readonly storage: FileStorage,
  ) {}

  /** Checks an uploaded photo, stores its copies and remembers who uploaded it. */
  async upload(uploadedById: string, file: Buffer): Promise<UploadedImage> {
    const copies = await this.processor.process(file);
    const largest = copies.at(-1);

    if (!largest) {
      throw new Error('The image processor returned no copies');
    }

    const image = await this.prisma.image.create({
      data: {
        uploadedById,
        width: largest.width,
        height: largest.height,
        copyWidths: copies.map(({ width }) => width),
      },
    });

    try {
      await Promise.all(
        copies.map(({ width, body }) =>
          this.storage.put({ key: imageKey(image.id, width), body, contentType }),
        ),
      );
    } catch (error) {
      // Nobody has seen the id yet, so the row can go: the database never points to missing files.
      await this.prisma.image.delete({ where: { id: image.id } });

      throw error;
    }

    return {
      id: image.id,
      width: image.width,
      height: image.height,
      copies: copies.map(({ width, height }) => ({
        width,
        height,
        url: this.storage.publicUrl(imageKey(image.id, width)),
      })),
    };
  }
}
