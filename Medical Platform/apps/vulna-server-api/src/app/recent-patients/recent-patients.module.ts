import { Module } from "@nestjs/common"
import { AuditModule } from "../audit/audit.module"
import { ClinicalRecordModule } from "../clinical-record/clinical-record.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { DeviceModule } from "../device/device.module"
import { LoginModule } from "../login/login.module"
import { UserIdentityModule } from "../login/user-identity.module"
import { RegistryModule } from "../registry/registry.module"
import { RecentPatientsController } from "./controllers/recent-patients.controller"
import { RecentPatientRepository } from "./repositories/recent-patient.repository"
import { RecentPatientsService } from "./services/recent-patients.service"

// clinical-workflow.yaml listRecentPatients
@Module({
	imports: [
		AuditModule,
		ClinicalRecordModule,
		ConfigurationModule,
		DeviceModule,
		LoginModule,
		RegistryModule,
		UserIdentityModule,
	],
	controllers: [RecentPatientsController],
	providers: [RecentPatientRepository, RecentPatientsService],
})
export class RecentPatientsModule {}
