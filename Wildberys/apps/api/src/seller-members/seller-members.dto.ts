import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsUUID } from 'class-validator';

import { SellerMemberRole } from '../generated/prisma/enums.js';
import { normalizeEmail } from '../validation/normalize-email.js';

export class SellerTeamMember {
  @ApiProperty({ format: 'uuid' })
  readonly userId!: string;

  @ApiProperty()
  readonly email!: string;

  @ApiProperty({ type: String, nullable: true })
  readonly firstName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly lastName!: string | null;

  @ApiProperty({ enum: SellerMemberRole, enumName: 'SellerMemberRole' })
  readonly role!: SellerMemberRole;
}

export class AddSellerStaffBody {
  @ApiProperty({
    example: 'petr@studiolila.cz',
    description: 'The person must already have an account.',
  })
  @Transform(normalizeEmail)
  @IsEmail()
  readonly email!: string;
}

export class SellerParams {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly sellerId!: string;
}

export class SellerMemberParams extends SellerParams {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly userId!: string;
}
