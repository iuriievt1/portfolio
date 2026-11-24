import { Module } from "@nestjs/common"
import { AdministrationSessionModule } from "../administration-session/administration-session.module"
import { AuditModule } from "../audit/audit.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { DeviceModule } from "../device/device.module"
import { LoginModule } from "../login/login.module"
import { UserIdentityModule } from "../login/user-identity.module"
import { RequestRateModule } from "../request-rate/request-rate.module"
import { PatientController } from "./controllers/patient.controller"
import { SyncStateController } from "./controllers/sync-state.controller"
import { PatientRepository } from "./repositories/patient.repository"
import { SyncStateRepository } from "./repositories/sync-state.repository"
import { PatientIdentificationService } from "./services/patient-identification.service"
import { PatientLookupService } from "./services/patient-lookup.service"
import { SyncStateService } from "./services/sync-state.service"

// CAP-013, CAP-024
@Module({
	imports: [
		AdministrationSessionModule,
		AuditModule,
		ConfigurationModule,
		DeviceModule,
		LoginModule,
		RequestRateModule,
		UserIdentityModule,
	],
	controllers: [PatientController, SyncStateController],
	providers: [
		PatientRepository,
		PatientIdentificationService,
		PatientLookupService,
		SyncStateRepository,
		SyncStateService,
	],
	exports: [PatientLookupService],
})
export class RegistryModule {}
