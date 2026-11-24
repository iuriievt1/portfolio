import { SyslogAuditSink } from "@ansora/vulna-adapter-syslog"
import { Module } from "@nestjs/common"
import { AUDIT_SINK_FACTORY } from "./constants/audit-export.constants"
import { AuditExportRepository } from "./repositories/audit-export.repository"
import { AuditExportService } from "./services/audit-export.service"
import { SyslogSettingsService } from "./services/syslog-settings.service"
import type { AuditSinkFactory } from "./types/audit-export.types"

const syslogSink: AuditSinkFactory = (settings) => new SyslogAuditSink(settings)

// ADR-003, ADR-005
@Module({
	providers: [
		AuditExportRepository,
		SyslogSettingsService,
		AuditExportService,
		{ provide: AUDIT_SINK_FACTORY, useValue: syslogSink },
	],
})
export class AuditExportModule {}
