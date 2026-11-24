import { JOB_KIND, JOB_OBJECT_KIND, QueueTaskStore } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"

// CAP-021-R36, CAP-021-R39, CAP-022-R17, datovy-model.md 4
@Injectable()
export class PdfUploadTaskRepository {
	private readonly queue: QueueTaskStore

	constructor(database: DatabaseService) {
		this.queue = new QueueTaskStore(database)
	}

	// queue_task_open_uniq
	async enqueue(tx: postgres.TransactionSql, documentId: string): Promise<void> {
		await this.queue.enqueue(tx, {
			kind: JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD,
			objectKind: JOB_OBJECT_KIND.DOCUMENT,
			objectId: documentId,
		})
	}
}
