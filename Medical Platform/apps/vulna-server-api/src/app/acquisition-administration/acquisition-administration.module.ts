import { Module } from "@nestjs/common"
import { AcquisitionModule } from "../acquisition/acquisition.module"
import { AdministrationSessionModule } from "../administration-session/administration-session.module"
import { AuditModule } from "../audit/audit.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { RegistryModule } from "../registry/registry.module"
import { AcquisitionAdministrationController } from "./controllers/acquisition-administration.controller"
import { AdministeredAcquisitionRepository } from "./repositories/administered-acquisition.repository"
import { AcquisitionAdministrationService } from "./services/acquisition-administration.service"

// CAP-004-R10
@Module({
	imports: [AcquisitionModule, AdministrationSessionModule, AuditModule, ConfigurationModule, RegistryModule],
	controllers: [AcquisitionAdministrationController],
	providers: [AdministeredAcquisitionRepository, AcquisitionAdministrationService],
})
export class AcquisitionAdministrationModule {}
