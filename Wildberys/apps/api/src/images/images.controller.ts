import { Controller, HttpStatus, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthContext } from '../auth/auth-context.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { AppException } from '../errors/app.exception.js';
import { maxUploadBytes } from './image-policy.js';
import { UploadedImage } from './images.dto.js';
import { ImagesService } from './images.service.js';

const fileField = 'file';

/** The part of the uploaded file this route uses. The file is kept in memory. */
interface UploadedPhoto {
  readonly buffer: Buffer;
}

@ApiTags('Images')
@Controller('images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Post()
  // The file is kept in memory: it is small, and the copies are made from it right away.
  @UseInterceptors(FileInterceptor(fileField, { limits: { fileSize: maxUploadBytes, files: 1 } }))
  @ApiOperation({
    summary: 'Upload a photo',
    description:
      'Takes a JPEG, PNG or WebP of up to 10 MB. Stores WebP copies in several sizes and returns their addresses.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [fileField],
      properties: { [fileField]: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: UploadedImage })
  upload(
    @CurrentAuth() auth: AuthContext,
    @UploadedFile() file: UploadedPhoto | undefined,
  ): Promise<UploadedImage> {
    if (!file) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'IMAGE_REQUIRED',
        `Send the photo in the "${fileField}" field of a multipart form`,
      );
    }

    return this.images.upload(auth.userId, file.buffer);
  }
}
