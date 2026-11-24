import { Module } from "@nestjs/common"
import { AcquisitionDraftRepository } from "../acquisition/repositories/acquisition-draft.repository"
import { AcquisitionFileRepository } from "../acquisition/repositories/acquisition-file.repository"
import { DecidedAcquisitionRepository } from "../acquisition/repositories/decided-acquisition.repository"
import { DocumentRepository } from "../acquisition/repositories/document.repository"
import { SeriesRepository } from "../acquisition/repositories/series.repository"
import { ScanDocumentService } from "../acquisition/services/scan-document.service"
import { AuditModule } from "../audit/audit.module"
import { BinaryObjectModule } from "../binary-object/binary-object.module"
import { ClinicalRecordModule } from "../clinical-record/clinical-record.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { DeviceModule } from "../device/device.module"
import { FindingModule } from "../finding/finding.module"
import { ImageModule } from "../image/image.module"
import { LoginModule } from "../login/login.module"
import { UserIdentityModule } from "../login/user-identity.module"
import { RegistryModule } from "../registry/registry.module"
import { EncounterController } from "./controllers/encounter.controller"
import { EncounterRepository } from "./repositories/encounter.repository"
import { RecordContentRepository } from "./repositories/record-content.repository"
import { UnfinishedEncounterRepository } from "./repositories/unfinished-encounter.repository"
import { EncounterService } from "./services/encounter.service"
import { EncounterCancellationService } from "./services/encounter-cancellation.service"
import { EncounterEmptyingService } from "./services/encounter-emptying.service"
import { EncounterRejectionService } from "./services/encounter-rejection.service"
import { EncounterTargetService } from "./services/encounter-target.service"
import { EncounterViewService } from "./services/encounter-view.service"
import { UnfinishedEncounterService } from "./services/unfinished-encounter.service"

// CAP-014
@Module({
	imports: [
		AuditModule,
		BinaryObjectModule,
		ClinicalRecordModule,
		ConfigurationModule,
		DeviceModule,
		FindingModule,
		ImageModule,
		LoginModule,
		RegistryModule,
		UserIdentityModule,
	],
	controllers: [EncounterController],
	providers: [
		EncounterRepository,
		AcquisitionDraftRepository,
		AcquisitionFileRepository,
		DecidedAcquisitionRepository,
		DocumentRepository,
		SeriesRepository,
		ScanDocumentService,
		EncounterService,
		EncounterRejectionService,
		EncounterEmptyingService,
		EncounterCancellationService,
		EncounterTargetService,
		EncounterViewService,
		RecordContentRepository,
		UnfinishedEncounterRepository,
		UnfinishedEncounterService,
	],
	exports: [
		EncounterRepository,
		AcquisitionDraftRepository,
		EncounterRejectionService,
		EncounterEmptyingService,
		EncounterTargetService,
		EncounterViewService,
	],
})
export class EncounterModule {}
