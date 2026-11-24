import { Module } from "@nestjs/common"
import { AdministrationSessionModule } from "../administration-session/administration-session.module"
import { AuditModule } from "../audit/audit.module"
import { BinaryObjectModule } from "../binary-object/binary-object.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { AdministratorAlertDataModule } from "../monitoring/administrator-alert-data.module"
import { OrphanedObjectController } from "./controllers/orphaned-object.controller"
import { OrphanedObjectRepository } from "./repositories/orphaned-object.repository"
import { OrphanedObjectService } from "./services/orphaned-object.service"

// CAP-026-R14, CAP-026-S08
@Module({
	imports: [
		AdministrationSessionModule,
		AuditModule,
		ConfigurationModule,
		AdministratorAlertDataModule,
		BinaryObjectModule,
	],
	controllers: [OrphanedObjectController],
	providers: [OrphanedObjectRepository, OrphanedObjectService],
})
export class OrphanedObjectModule {}
