import { Module } from "@nestjs/common"
import { AdministrationSessionModule } from "../administration-session/administration-session.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { AdministratorAlertDataModule } from "../monitoring/administrator-alert-data.module"
import { AuditModule } from "./audit.module"
import { AuditAdministrationController } from "./controllers/audit-administration.controller"
import { AuditQueryRepository } from "./repositories/audit-query.repository"
import { AuditAdministrationService } from "./services/audit-administration.service"

// CAP-025-R07, CAP-025-R21
@Module({
	imports: [AuditModule, AdministrationSessionModule, ConfigurationModule, AdministratorAlertDataModule],
	controllers: [AuditAdministrationController],
	providers: [AuditQueryRepository, AuditAdministrationService],
})
export class AuditAdministrationModule {}
