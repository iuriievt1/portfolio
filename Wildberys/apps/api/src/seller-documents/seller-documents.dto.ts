import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

import { SellerDocumentKind } from '../generated/prisma/enums.js';
import { trimText } from '../validation/trim-text.js';
import { fileNameMaxLength } from './document-file.js';

/** The fields that come with the file of a document in a multipart form. */
export class AddDocumentBody {
  @ApiProperty({
    enum: SellerDocumentKind,
    enumName: 'SellerDocumentKind',
    description:
      'IDENTITY_DOCUMENT: the identity document of the trader or of the person who acts for the company. ' +
      'REGISTER_EXTRACT: the extract from the business register. OTHER: anything else the team asked for.',
  })
  @IsEnum(SellerDocumentKind)
  readonly kind!: SellerDocumentKind;

  @ApiProperty({
    example: 'Výpis z rejstříku.pdf',
    maxLength: fileNameMaxLength,
    description:
      'The name of the file on the device. It is only shown, the type is read from the file.',
  })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(fileNameMaxLength)
  readonly fileName!: string;
}

/** A document of a seller, without its file. */
export class SellerDocumentInfo {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ enum: SellerDocumentKind, enumName: 'SellerDocumentKind' })
  readonly kind!: SellerDocumentKind;

  @ApiProperty({ example: 'Výpis z rejstříku.pdf' })
  readonly fileName!: string;

  @ApiProperty({ example: 'application/pdf', description: 'A PDF, a JPEG or a PNG.' })
  readonly contentType!: string;

  @ApiProperty({ type: 'integer', example: 184320 })
  readonly sizeBytes!: number;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt!: Date;
}
