import { ApiProperty } from '@nestjs/swagger';

import { accessLevels, type AccessLevel, type PlatformArea } from './platform-access.js';

const level = { enum: accessLevels, enumName: 'AccessLevel' };

/**
 * What a user may do in each section of the admin: nothing, view only, or everything.
 * The compiler asks for a new property here when a section is added to platformAreas.
 */
export class PlatformAccess implements Record<PlatformArea, AccessLevel> {
  @ApiProperty(level)
  readonly overview!: AccessLevel;

  @ApiProperty(level)
  readonly sellers!: AccessLevel;

  @ApiProperty(level)
  readonly products!: AccessLevel;

  @ApiProperty(level)
  readonly dsaNotices!: AccessLevel;

  @ApiProperty(level)
  readonly supportTickets!: AccessLevel;

  @ApiProperty(level)
  readonly disputesAndReturns!: AccessLevel;

  @ApiProperty(level)
  readonly payouts!: AccessLevel;

  @ApiProperty(level)
  readonly commissions!: AccessLevel;

  @ApiProperty(level)
  readonly logistics!: AccessLevel;

  @ApiProperty(level)
  readonly catalog!: AccessLevel;

  @ApiProperty(level)
  readonly marketing!: AccessLevel;

  @ApiProperty(level)
  readonly roles!: AccessLevel;
}
