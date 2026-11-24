import { HttpStatus, Injectable } from '@nestjs/common';
import sharp from 'sharp';

import { AppException } from '../errors/app.exception.js';
import { acceptedFormats, copyWidths, maxInputPixels } from './image-policy.js';

export interface ProcessedCopy {
  readonly width: number;
  readonly height: number;
  readonly body: Buffer;
}

function invalidImage(cause?: unknown): AppException {
  return new AppException(
    HttpStatus.BAD_REQUEST,
    'IMAGE_INVALID',
    'The file is not a JPEG, PNG or WebP image',
    undefined,
    { cause },
  );
}

function isAcceptedFormat(format: string): boolean {
  return acceptedFormats.some((accepted) => accepted === format);
}

/** The widths to store for a photo of this width, smallest first. */
export function widthsFor(photoWidth: number): number[] {
  const largest = Math.min(photoWidth, copyWidths[copyWidths.length - 1] ?? photoWidth);

  return [...copyWidths.filter((width) => width < largest), largest];
}

/** Turns an uploaded file into the copies that are stored. */
@Injectable()
export class ImageProcessor {
  /**
   * Checks that the file is a real photo and makes its copies, smallest first.
   * Every copy is WebP, turned the right way up, without the data a camera adds (place, device).
   */
  async process(file: Buffer): Promise<ProcessedCopy[]> {
    try {
      const photo = sharp(file, { limitInputPixels: maxInputPixels, failOn: 'error' }).autoOrient();
      const { format, autoOrient } = await photo.metadata();

      if (!isAcceptedFormat(format)) {
        throw invalidImage();
      }

      return await Promise.all(
        widthsFor(autoOrient.width).map(async (width) => {
          const { data, info } = await photo
            .clone()
            .resize({ width, withoutEnlargement: true })
            .webp()
            .toBuffer({ resolveWithObject: true });

          return { width: info.width, height: info.height, body: data };
        }),
      );
    } catch (error) {
      // sharp throws for anything it cannot read: a text file, a broken or a too large picture.
      throw error instanceof AppException ? error : invalidImage(error);
    }
  }
}
