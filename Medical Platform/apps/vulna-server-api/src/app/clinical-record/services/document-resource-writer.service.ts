import type { ClinicalRecordStorePort, ClinicalScannedDocumentPdf } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import { DocumentResourceTaskRepository } from "../repositories/document-resource-task.repository"
import type { ClaimedWriteTask, ResourceWrite } from "../types/clinical-record.types"
import { ClinicalRecordStoreService } from "./clinical-record-store.service"
import { ResourceWriter } from "./resource-writer"
import { ScannedDocumentContentService } from "./scanned-document-content.service"

// CAP-021-R39, CAP-026-R20, backend.md 3.1 T7, datovy-model.md 4
@Injectable()
export class DocumentResourceWriterService extends ResourceWriter<ResourceWrite<ClinicalScannedDocumentPdf>> {
	protected readonly logger = new Logger(DocumentResourceWriterService.name)

	constructor(
		tasks: DocumentResourceTaskRepository,
		stores: ClinicalRecordStoreService,
		private readonly content: ScannedDocumentContentService,
	) {
		super(tasks, stores)
	}

	protected subjectOf(task: ClaimedWriteTask): string {
		return `the PDF of document ${task.objectId}`
	}

	protected async contentOf(
		task: ClaimedWriteTask,
		store: ClinicalRecordStorePort,
	): Promise<ResourceWrite<ClinicalScannedDocumentPdf> | undefined> {
		return await this.content.contentOf(task.objectId, store)
	}

	protected async record(
		store: ClinicalRecordStorePort,
		document: ResourceWrite<ClinicalScannedDocumentPdf>,
	): Promise<string> {
		return await store.recordScannedDocumentPdf(document.resource)
	}

	protected async remember(
		task: ClaimedWriteTask,
		resourceId: string,
		document: ResourceWrite<ClinicalScannedDocumentPdf>,
	): Promise<void> {
		await this.content.remember(task.objectId, resourceId, document.detaching)
	}
}
