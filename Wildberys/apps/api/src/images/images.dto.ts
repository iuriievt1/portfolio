import { ApiProperty } from '@nestjs/swagger';

export class ImageCopy {
  @ApiProperty({ type: 'integer' })
  readonly width!: number;

  @ApiProperty({ type: 'integer' })
  readonly height!: number;

  @ApiProperty({ description: 'The address of the file. It is WebP and never changes.' })
  readonly url!: string;
}

export class UploadedImage {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ type: 'integer', description: 'Width of the largest copy in pixels.' })
  readonly width!: number;

  @ApiProperty({ type: 'integer', description: 'Height of the largest copy in pixels.' })
  readonly height!: number;

  @ApiProperty({ type: [ImageCopy], description: 'The stored copies, smallest first.' })
  readonly copies!: ImageCopy[];
}
