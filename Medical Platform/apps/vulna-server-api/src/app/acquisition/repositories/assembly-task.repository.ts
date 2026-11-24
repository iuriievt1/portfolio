import { randomUUID } from "node:crypto"
import { JOB_KIND, JOB_OBJECT_KIND, JOB_STATE } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"

// datovy-model.md 4, ADR-005, ADR-016
@Injectable()
export class AssemblyTaskRepository {
	// CAP-021-R25, CAP-021-R29, CAP-021-S08, queue_task_open_uniq
	async enqueue(tx: postgres.TransactionSql, acquisitionId: string): Promise<void> {
		await this.enqueueAll(tx, [acquisitionId])
	}

	// CAP-021-S08, queue_task_open_uniq
	async enqueueAll(tx: postgres.TransactionSql, acquisitionIds: readonly string[]): Promise<void> {
		if (acquisitionIds.length === 0) {
			return
		}
		const rows = acquisitionIds.map((acquisitionId) => ({
			id: randomUUID(),
			kind: JOB_KIND.ASSEMBLY,
			object_kind: JOB_OBJECT_KIND.ACQUISITION,
			object_id: acquisitionId,
			state: JOB_STATE.WAITING,
		}))
		await tx`
			INSERT INTO queue_task ${tx(rows, "id", "kind", "object_kind", "object_id", "state")}
			ON CONFLICT (kind, object_kind, object_id) WHERE state IN ('waiting', 'running') DO NOTHING
		`
	}
}
