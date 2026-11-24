import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsUUID } from 'class-validator';

import { PlatformRole } from '../generated/prisma/enums.js';
import { normalizeEmail } from '../validation/normalize-email.js';

export class TeamMember {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty()
  readonly email!: string;

  @ApiProperty({ type: String, nullable: true })
  readonly firstName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly lastName!: string | null;

  @ApiProperty({ enum: PlatformRole, enumName: 'PlatformRole', isArray: true })
  readonly roles!: PlatformRole[];
}

export class GrantTeamRoleBody {
  @ApiProperty({
    example: 'maria@bluberi.cz',
    description: 'The person must already have an account.',
  })
  @Transform(normalizeEmail)
  @IsEmail()
  readonly email!: string;

  @ApiProperty({ enum: PlatformRole, enumName: 'PlatformRole' })
  @IsEnum(PlatformRole)
  readonly role!: PlatformRole;
}

export class TeamRoleParams {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly userId!: string;

  @ApiProperty({ enum: PlatformRole, enumName: 'PlatformRole' })
  @IsEnum(PlatformRole)
  readonly role!: PlatformRole;
}
