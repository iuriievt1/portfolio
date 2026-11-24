import { Module } from "@nestjs/common"
import { DependencyStateModule } from "../../libs/dependency-state/dependency-state.module"
import { AuditModule } from "../audit/audit.module"
import { BinaryObjectModule } from "../binary-object/binary-object.module"
import { CodeListDataModule } from "../code-list/code-list-data.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { AdministratorAlertDataModule } from "../monitoring/administrator-alert-data.module"
import { ActorTaskRepository } from "./repositories/actor-task.repository"
import { ClinicalActorRepository } from "./repositories/clinical-actor.repository"
import { ClinicalPatientRepository } from "./repositories/clinical-patient.repository"
import { ClosingDeviceRepository } from "./repositories/closing-device.repository"
import { CodeListSetTaskRepository } from "./repositories/code-list-set-task.repository"
import { DeliveredInstanceRepository } from "./repositories/delivered-instance.repository"
import { DeliveryResourceTaskRepository } from "./repositories/delivery-resource-task.repository"
import { DocumentResourceTaskRepository } from "./repositories/document-resource-task.repository"
import { FhirResourceLinkRepository } from "./repositories/fhir-resource-link.repository"
import { FileResourceRepository } from "./repositories/file-resource.repository"
import { ImageResourceTaskRepository } from "./repositories/image-resource-task.repository"
import { PageResourceTaskRepository } from "./repositories/page-resource-task.repository"
import { ActorWriterService } from "./services/actor-writer.service"
import { ClinicalContentService } from "./services/clinical-content.service"
import { ClinicalReadService } from "./services/clinical-read.service"
import { ClinicalRecordStoreService } from "./services/clinical-record-store.service"
import { ClinicalRenditionService } from "./services/clinical-rendition.service"
import { ClosureRecordService } from "./services/closure-record.service"
import { CodeListPublisherService } from "./services/code-list-publisher.service"
import { DeliveryContentService } from "./services/delivery-content.service"
import { DeliveryResourceWriterService } from "./services/delivery-resource-writer.service"
import { DocumentRecordService } from "./services/document-record.service"
import { DocumentResourceWriterService } from "./services/document-resource-writer.service"
import { EncounterRecordService } from "./services/encounter-record.service"
import { FileResourceContentService } from "./services/file-resource-content.service"
import { FindingRecordService } from "./services/finding-record.service"
import { ImageResourceWriterService } from "./services/image-resource-writer.service"
import { PageResourceWriterService } from "./services/page-resource-writer.service"
import { ReadCircuitService } from "./services/read-circuit.service"
import { ScannedDocumentContentService } from "./services/scanned-document-content.service"
import { ViewerService } from "./services/viewer.service"

// ADR-054 bod 1, ADR-054 bod 2, ADR-054 bod 3, CAP-021-R37, CAP-021-R39
@Module({
	imports: [
		AuditModule,
		BinaryObjectModule,
		ConfigurationModule,
		CodeListDataModule,
		AdministratorAlertDataModule,
		DependencyStateModule,
	],
	providers: [
		ActorTaskRepository,
		CodeListSetTaskRepository,
		CodeListPublisherService,
		ClinicalActorRepository,
		ClinicalPatientRepository,
		ClosingDeviceRepository,
		FhirResourceLinkRepository,
		ClinicalRecordStoreService,
		ClinicalContentService,
		ClinicalReadService,
		ReadCircuitService,
		ActorWriterService,
		EncounterRecordService,
		FindingRecordService,
		DocumentRecordService,
		ClosureRecordService,
		ViewerService,
		FileResourceRepository,
		FileResourceContentService,
		ImageResourceTaskRepository,
		DeliveryResourceTaskRepository,
		DeliveredInstanceRepository,
		DeliveryContentService,
		DeliveryResourceWriterService,
		PageResourceTaskRepository,
		ImageResourceWriterService,
		PageResourceWriterService,
		ClinicalRenditionService,
		ScannedDocumentContentService,
		DocumentResourceTaskRepository,
		DocumentResourceWriterService,
	],
	exports: [
		ActorTaskRepository,
		CodeListSetTaskRepository,
		ClinicalActorRepository,
		ClosingDeviceRepository,
		ClinicalReadService,
		ClinicalRecordStoreService,
		EncounterRecordService,
		FindingRecordService,
		DocumentRecordService,
		ClosureRecordService,
		ViewerService,
	],
})
export class ClinicalRecordModule {}
