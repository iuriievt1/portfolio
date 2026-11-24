import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { Locale } from '../generated/prisma/enums.js';

export class CategoryTreeQuery {
  @ApiProperty({ enum: Locale, enumName: 'Locale', description: 'The language of the names.' })
  @IsEnum(Locale)
  readonly locale!: Locale;
}

export class Subcategory {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'zeny-saty' })
  readonly slug!: string;

  @ApiProperty({ example: 'Šaty' })
  readonly name!: string;
}

/** A top-level category with what it is split into. */
export class CategorySection {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'zeny' })
  readonly slug!: string;

  @ApiProperty({ example: 'Ženy' })
  readonly name!: string;

  @ApiProperty({ type: [Subcategory], description: 'In the order of the catalog.' })
  readonly subcategories!: Subcategory[];
}
