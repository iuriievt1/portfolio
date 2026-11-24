import { Module } from "@nestjs/common"
import { ClinicalRecordModule } from "../clinical-record/clinical-record.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { DeviceModule } from "../device/device.module"
import { EncounterModule } from "../encounter/encounter.module"
import { ImageModule } from "../image/image.module"
import { LoginModule } from "../login/login.module"
import { UserIdentityModule } from "../login/user-identity.module"
import { RegistryModule } from "../registry/registry.module"
import { PatientDocumentController } from "./controllers/patient-document.controller"
import { PatientDocumentRepository } from "./repositories/patient-document.repository"
import { PatientDocumentsService } from "./services/patient-documents.service"

// CAP-020-R18
@Module({
	imports: [
		ClinicalRecordModule,
		ConfigurationModule,
		DeviceModule,
		EncounterModule,
		ImageModule,
		LoginModule,
		RegistryModule,
		UserIdentityModule,
	],
	controllers: [PatientDocumentController],
	providers: [PatientDocumentRepository, PatientDocumentsService],
})
export class DocumentModule {}
