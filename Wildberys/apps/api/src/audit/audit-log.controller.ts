import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePlatformAccess } from '../access/access.decorators.js';
import { AuditLogPage, AuditLogQuery } from './audit-log.dto.js';
import { AuditLogService } from './audit-log.service.js';

@ApiTags('Admin: audit log')
@Controller('admin/audit-log')
// In design 04 the audit log is on the "Роли и доступы" screen, so it follows the access to roles.
@RequirePlatformAccess({ area: 'roles', level: 'view' })
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'Who did what and when, newest first' })
  @ApiOkResponse({ type: AuditLogPage })
  list(@Query() query: AuditLogQuery): Promise<AuditLogPage> {
    return this.auditLog.list(query);
  }
}
