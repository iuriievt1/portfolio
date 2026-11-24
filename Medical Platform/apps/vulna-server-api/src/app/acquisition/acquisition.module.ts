import { Module } from "@nestjs/common"
import { HpkeModule } from "../../libs/hpke/hpke.module"
import { AuditModule } from "../audit/audit.module"
import { BinaryObjectModule } from "../binary-object/binary-object.module"
import { ClinicalRecordModule } from "../clinical-record/clinical-record.module"
import { CodeListModule } from "../code-list/code-list.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { DeviceModule } from "../device/device.module"
import { EncounterModule } from "../encounter/encounter.module"
import { FindingModule } from "../finding/finding.module"
import { ClinicianRoleGuard } from "../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../login/guards/user-session.guard"
import { LoginModule } from "../login/login.module"
import { UserIdentityModule } from "../login/user-identity.module"
import { RegistryModule } from "../registry/registry.module"
import { RequestRateModule } from "../request-rate/request-rate.module"
import { AcquisitionController } from "./controllers/acquisition.controller"
import { AcquisitionAnnouncementController } from "./controllers/acquisition-announcement.controller"
import { AcquisitionDecisionController } from "./controllers/acquisition-decision.controller"
import { AcquisitionFileController } from "./controllers/acquisition-file.controller"
import { AcquisitionUploadController } from "./controllers/acquisition-upload.controller"
import { QueueSenderGuard } from "./guards/queue-sender.guard"
import { AcquisitionFileRepository } from "./repositories/acquisition-file.repository"
import { AcquisitionUpdateRequestRepository } from "./repositories/acquisition-update-request.repository"
import { AssemblyTaskRepository } from "./repositories/assembly-task.repository"
import { DecidedAcquisitionRepository } from "./repositories/decided-acquisition.repository"
import { DeliveryRepository } from "./repositories/delivery.repository"
import { DocumentRepository } from "./repositories/document.repository"
import { FileUploadTaskRepository } from "./repositories/file-upload-task.repository"
import { SeriesRepository } from "./repositories/series.repository"
import { UploadPermissionRepository } from "./repositories/upload-permission.repository"
import { AcquisitionAssignmentService } from "./services/acquisition-assignment.service"
import { AcquisitionCancellationService } from "./services/acquisition-cancellation.service"
import { AcquisitionClosureService } from "./services/acquisition-closure.service"
import { AcquisitionDiscardService } from "./services/acquisition-discard.service"
import { AcquisitionDraftService } from "./services/acquisition-draft.service"
import { AcquisitionDraftViewService } from "./services/acquisition-draft-view.service"
import { AcquisitionFileAnnouncementService } from "./services/acquisition-file-announcement.service"
import { AcquisitionFileOrderService } from "./services/acquisition-file-order.service"
import { AcquisitionFileRemovalService } from "./services/acquisition-file-removal.service"
import { AcquisitionFileReplacementService } from "./services/acquisition-file-replacement.service"
import { AcquisitionFileUploadService } from "./services/acquisition-file-upload.service"
import { AcquisitionUpdateService } from "./services/acquisition-update.service"
import { DocumentTitleService } from "./services/document-title.service"
import { DraftAccessService } from "./services/draft-access.service"
import { DraftRemovalService } from "./services/draft-removal.service"
import { OperatorVerificationService } from "./services/operator-verification.service"
import { ScanDocumentService } from "./services/scan-document.service"
import { StoredContentService } from "./services/stored-content.service"
import { UploadPermissionService } from "./services/upload-permission.service"
import { UploadedContentService } from "./services/uploaded-content.service"

// CAP-015-R30, CAP-014-R06, CAP-014-R25, CAP-021-R29, CAP-015-R35, CAP-021-R25, CAP-021-R35, CAP-021-R11
@Module({
	imports: [
		AuditModule,
		BinaryObjectModule,
		ClinicalRecordModule,
		CodeListModule,
		ConfigurationModule,
		DeviceModule,
		EncounterModule,
		FindingModule,
		HpkeModule,
		LoginModule,
		RegistryModule,
		RequestRateModule,
		UserIdentityModule,
	],
	controllers: [
		AcquisitionController,
		AcquisitionAnnouncementController,
		AcquisitionFileController,
		AcquisitionUploadController,
		AcquisitionDecisionController,
	],
	providers: [
		AcquisitionDraftService,
		AcquisitionDraftViewService,
		AcquisitionAssignmentService,
		AcquisitionUpdateService,
		AcquisitionUpdateRequestRepository,
		AcquisitionFileRepository,
		DocumentRepository,
		DecidedAcquisitionRepository,
		SeriesRepository,
		AssemblyTaskRepository,
		DeliveryRepository,
		FileUploadTaskRepository,
		UploadPermissionRepository,
		UploadPermissionService,
		UserSessionGuard,
		ClinicianRoleGuard,
		QueueSenderGuard,
		DraftAccessService,
		DraftRemovalService,
		ScanDocumentService,
		OperatorVerificationService,
		UploadedContentService,
		StoredContentService,
		DocumentTitleService,
		AcquisitionFileAnnouncementService,
		AcquisitionFileUploadService,
		AcquisitionFileRemovalService,
		AcquisitionFileReplacementService,
		AcquisitionFileOrderService,
		AcquisitionClosureService,
		AcquisitionDiscardService,
		AcquisitionCancellationService,
	],
	exports: [AcquisitionFileRepository, DocumentRepository, DraftRemovalService],
})
export class AcquisitionModule {}
