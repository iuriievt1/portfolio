import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsEmail, IsEnum, MaxLength } from 'class-validator';

import { Locale } from '../generated/prisma/enums.js';
import { emailMaxLength, normalizeEmail } from '../validation/normalize-email.js';

export class SubscribeBody {
  @ApiProperty({ example: 'jana@example.cz' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(emailMaxLength)
  readonly email!: string;

  @ApiProperty({
    enum: Locale,
    enumName: 'Locale',
    description: 'The language of the page. The news is written in it.',
  })
  @IsEnum(Locale)
  readonly locale!: Locale;

  @ApiProperty({
    enum: [true],
    description: 'The person agreed to get news by email. Only true is accepted.',
  })
  @Equals(true)
  readonly consent!: boolean;
}

export class UnsubscribeBody {
  @ApiProperty({ example: 'jana@example.cz' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(emailMaxLength)
  readonly email!: string;
}

export class NewsletterSubscriptionView {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty()
  readonly email!: string;

  @ApiProperty({ enum: Locale, enumName: 'Locale' })
  readonly locale!: Locale;

  @ApiProperty({ type: String, format: 'date-time', description: 'When the person agreed.' })
  readonly consentedAt!: Date;
}

export class NewsletterPage {
  @ApiProperty({ type: [NewsletterSubscriptionView], description: 'Newest first.' })
  readonly items!: NewsletterSubscriptionView[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Send it as the cursor to get the next page. Null on the last page.',
  })
  readonly nextCursor!: string | null;
}
