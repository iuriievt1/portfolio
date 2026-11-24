import type { ClinicalDelivery, ClinicalRecordStorePort } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { lockEncounterClosing } from "../../../libs/database/encounter-closing-lock"
import { DeliveryResourceTaskRepository } from "../repositories/delivery-resource-task.repository"
import type { ClaimedWriteTask } from "../types/clinical-record.types"
import { ClinicalRecordStoreService } from "./clinical-record-store.service"
import { DeliveryContentService } from "./delivery-content.service"
import { ResourceWriter } from "./resource-writer"

// CAP-021-R28, backend.md 3 T4, datovy-model.md 13.1, ADR-054 bod 3
@Injectable()
export class DeliveryResourceWriterService extends ResourceWriter<ClinicalDelivery> {
	protected readonly logger = new Logger(DeliveryResourceWriterService.name)

	constructor(
		tasks: DeliveryResourceTaskRepository,
		stores: ClinicalRecordStoreService,
		private readonly content: DeliveryContentService,
		private readonly database: DatabaseService,
	) {
		super(tasks, stores)
	}

	protected subjectOf(task: ClaimedWriteTask): string {
		return `the delivery of record ${task.objectId}`
	}

	protected async contentOf(task: ClaimedWriteTask): Promise<ClinicalDelivery | undefined> {
		return await this.content.contentOf(task.objectId)
	}

	// backend.md 3 „Souběh“
	protected async record(store: ClinicalRecordStorePort, delivery: ClinicalDelivery): Promise<string> {
		return await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await lockEncounterClosing(tx, delivery.study.encounterId)
			return await store.recordDelivery(delivery)
		})
	}

	protected async remember(task: ClaimedWriteTask, resourceId: string): Promise<void> {
		await this.content.remember(task.objectId, resourceId)
	}
}
