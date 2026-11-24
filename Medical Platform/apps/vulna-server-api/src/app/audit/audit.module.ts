import { Module } from "@nestjs/common"
import { AuditRepository } from "./repositories/audit.repository"

@Module({
	providers: [AuditRepository],
	exports: [AuditRepository],
})
export class AuditModule {}
