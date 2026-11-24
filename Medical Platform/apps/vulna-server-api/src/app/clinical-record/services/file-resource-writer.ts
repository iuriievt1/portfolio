import type { ClinicalFileResource, ClinicalRecordStorePort } from "@ansora/vulna-domain"
import type { WriteTaskRepository } from "../repositories/write-task.repository"
import type { ClaimedWriteTask, FileResourceObjectKind, ResourceWrite } from "../types/clinical-record.types"
import type { ClinicalRecordStoreService } from "./clinical-record-store.service"
import type { FileResourceContentService } from "./file-resource-content.service"
import { ResourceWriter } from "./resource-writer"

// CAP-021-R37, CAP-021-S30, CAP-026-R19, ADR-050 bod 13, datovy-model.md 4
export abstract class FileResourceWriter extends ResourceWriter<ResourceWrite<ClinicalFileResource>> {
	protected abstract readonly kind: FileResourceObjectKind

	protected constructor(
		tasks: WriteTaskRepository,
		stores: ClinicalRecordStoreService,
		private readonly content: FileResourceContentService,
	) {
		super(tasks, stores)
	}

	protected subjectOf(task: ClaimedWriteTask): string {
		return `the resource of ${this.kind} ${task.objectId}`
	}

	protected async contentOf(
		task: ClaimedWriteTask,
		store: ClinicalRecordStorePort,
	): Promise<ResourceWrite<ClinicalFileResource> | undefined> {
		return await this.content.contentOf(this.kind, task.objectId, store)
	}

	protected async record(store: ClinicalRecordStorePort, file: ResourceWrite<ClinicalFileResource>): Promise<string> {
		return await store.recordFileResource(file.resource)
	}

	protected async remember(
		task: ClaimedWriteTask,
		resourceId: string,
		file: ResourceWrite<ClinicalFileResource>,
	): Promise<void> {
		await this.content.remember(this.kind, task.objectId, resourceId, file.detaching)
	}
}
