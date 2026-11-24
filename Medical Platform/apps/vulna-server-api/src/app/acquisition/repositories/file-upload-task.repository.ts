import { randomUUID } from "node:crypto"
import { ACQUISITION_KIND, type AcquisitionKind } from "@ansora/contracts"
import { JOB_KIND, JOB_OBJECT_KIND, JOB_STATE } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"

const FILE_OBJECT_KIND = {
	[ACQUISITION_KIND.PHOTO]: JOB_OBJECT_KIND.IMAGE,
	[ACQUISITION_KIND.SCAN]: JOB_OBJECT_KIND.DOCUMENT_PAGE,
} as const satisfies Record<AcquisitionKind, string>

// CAP-021-R40, CAP-021-R36, datovy-model.md 4
const CLOSURE_JOBS = [JOB_KIND.CLINICAL_RECORD_VIEWING_COPY, JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD] as const

// datovy-model.md 4, ADR-016
@Injectable()
export class FileUploadTaskRepository {
	// CAP-021-R36, CAP-021-R40, CAP-021-S28, queue_task_open_uniq
	async enqueue(tx: postgres.TransactionSql, kind: AcquisitionKind, fileIds: readonly string[]): Promise<void> {
		if (fileIds.length === 0) {
			return
		}
		const tasks = fileIds.flatMap((fileId) =>
			CLOSURE_JOBS.map((job) => ({
				id: randomUUID(),
				kind: job,
				object_kind: FILE_OBJECT_KIND[kind],
				object_id: fileId,
				state: JOB_STATE.WAITING,
			})),
		)
		await tx`
			INSERT INTO queue_task ${tx(tasks, "id", "kind", "object_kind", "object_id", "state")}
			ON CONFLICT (kind, object_kind, object_id) WHERE state IN ('waiting', 'running') DO NOTHING
		`
	}
}
