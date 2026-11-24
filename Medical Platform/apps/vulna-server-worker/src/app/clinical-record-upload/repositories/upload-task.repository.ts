import {
	CLAIMED_TASK_ALIAS,
	JOB_STATE,
	type QueueClaimRule,
	type QueueCondition,
	QueueTaskStore,
} from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { UPLOAD_JOB_KIND, UPLOAD_OBJECT_KINDS } from "../constants/clinical-record-upload.constants"
import type { UploadJobKind, UploadObjectKindOf } from "../types/clinical-record-upload.types"

// datovy-model.md 4, ADR-016, CAP-021-R36, CAP-021-R40
@Injectable()
export class UploadTaskRepository {
	readonly queue: QueueTaskStore

	constructor(private readonly database: DatabaseService) {
		this.queue = new QueueTaskStore(database)
	}

	// ADR-016 ř. 54, datovy-model.md 4
	claimRuleOf<Kind extends UploadJobKind>(kind: Kind): QueueClaimRule<UploadObjectKindOf<Kind>> {
		return {
			kind,
			objectKinds: UPLOAD_OBJECT_KINDS[kind],
			condition: this.copyFinishedFirst(kind),
			countsAttempts: true,
		}
	}

	// CAP-021-R40 before CAP-021-R36, datovy-model.md 4
	private copyFinishedFirst(kind: UploadJobKind): QueueCondition | undefined {
		if (kind !== UPLOAD_JOB_KIND.BINARY_UPLOAD) {
			return undefined
		}
		const sql = this.database.sql
		const task = sql(CLAIMED_TASK_ALIAS)
		return sql`NOT EXISTS (
			SELECT 1 FROM queue_task copy
			WHERE copy.kind = ${UPLOAD_JOB_KIND.VIEWING_COPY}
				AND copy.object_kind = ${task}.object_kind
				AND copy.object_id = ${task}.object_id
				AND copy.state IN (${JOB_STATE.WAITING}, ${JOB_STATE.RUNNING})
		)`
	}
}
