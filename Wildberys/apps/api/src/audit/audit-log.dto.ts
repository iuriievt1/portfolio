import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

import { PageQuery } from '../pagination/page-query.js';
import { auditActions, type AuditAction } from './audit-events.js';

export class AuditLogQuery extends PageQuery {
  @ApiPropertyOptional({ format: 'uuid', description: 'Only what this person did.' })
  @IsOptional()
  @IsUUID()
  readonly actorId?: string;

  @ApiPropertyOptional({ enum: auditActions, enumName: 'AuditAction' })
  @IsOptional()
  @IsIn(auditActions)
  readonly action?: AuditAction;
}

export class AuditLogPerson {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty()
  readonly email!: string;

  @ApiProperty({ type: String, nullable: true })
  readonly firstName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly lastName!: string | null;
}

export class AuditLogItem {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ enum: auditActions, enumName: 'AuditAction' })
  readonly action!: AuditAction;

  @ApiProperty({ type: String, format: 'date-time' })
  readonly createdAt!: Date;

  @ApiProperty({
    type: AuditLogPerson,
    nullable: true,
    description: 'Who did it. Null when it was done from the command line.',
  })
  readonly actor!: AuditLogPerson | null;

  @ApiProperty({
    type: AuditLogPerson,
    nullable: true,
    description: 'The person it was done to, for example who got a role. Null when there is none.',
  })
  readonly targetUser!: AuditLogPerson | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Facts that depend on the action, for example the role that was given.',
  })
  readonly details!: Record<string, unknown>;
}

export class AuditLogPage {
  @ApiProperty({ type: [AuditLogItem], description: 'Newest first.' })
  readonly items!: AuditLogItem[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Send it as the cursor to get the next page. Null on the last page.',
  })
  readonly nextCursor!: string | null;
}
