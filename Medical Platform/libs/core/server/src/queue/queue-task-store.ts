import { randomUUID } from "node:crypto"
import type postgres from "@veevoy/postgres"
import { MILLISECONDS_PER_SECOND } from "../login/secret"
import type {
	ClaimedQueueTask,
	ClaimedQueueTaskRow,
	HeldQueueTask,
	NewQueueTask,
	QueueClaimRule,
	QueueCondition,
	QueueDatabase,
	QueueLease,
} from "./queue.types"
import { JOB_STATE } from "./queue-task"

const MICROSECONDS_PER_SECOND = 1_000_000

// ADR-016 ř. 54, datovy-model.md 4
export const CLAIMED_TASK_ALIAS = "task"

function secondsOf(milliseconds: number): number {
	return milliseconds / MILLISECONDS_PER_SECOND
}

// datovy-model.md 4, ADR-016
export class QueueTaskStore {
	constructor(private readonly database: QueueDatabase) {}

	// CAP-021-R31, queue_task_open_uniq
	async enqueue(tx: postgres.TransactionSql, task: NewQueueTask): Promise<void> {
		await tx`
			INSERT INTO queue_task (id, kind, object_kind, object_id, state)
			VALUES (${randomUUID()}, ${task.kind}, ${task.objectKind}, ${task.objectId}, ${JOB_STATE.WAITING})
			ON CONFLICT (kind, object_kind, object_id) WHERE state IN ('waiting', 'running')
			DO UPDATE SET run_after = CASE
				WHEN queue_task.state = ${JOB_STATE.RUNNING} THEN now()
				ELSE queue_task.run_after
			END
		`
	}

	// ADR-016 ř. 54, datovy-model.md 4
	async claim<ObjectKind extends string>(
		rule: QueueClaimRule<ObjectKind>,
		lockedBy: string,
		leaseMilliseconds: number,
	): Promise<ClaimedQueueTask<ObjectKind> | undefined> {
		const sql = this.database.sql
		const task = sql(CLAIMED_TASK_ALIAS)
		const [row] = await sql<ClaimedQueueTaskRow<ObjectKind>[]>`
			UPDATE queue_task SET
				state = ${JOB_STATE.RUNNING},
				attempts = attempts + ${rule.countsAttempts ? 1 : 0},
				locked_by = ${lockedBy},
				locked_until = now() + make_interval(secs => ${secondsOf(leaseMilliseconds)})
			WHERE id = (
				SELECT ${task}.id FROM queue_task ${task}
				WHERE ${task}.kind = ${rule.kind}
					AND ${this.objectKindsOf(sql, rule.objectKinds)}
					AND (
						(${task}.state = ${JOB_STATE.WAITING} AND ${task}.run_after <= now())
						OR (${task}.state = ${JOB_STATE.RUNNING} AND ${task}.locked_until < now())
					)
					AND ${rule.condition ?? sql`TRUE`}
				ORDER BY ${task}.run_after
				LIMIT 1
				FOR UPDATE SKIP LOCKED
			)
			RETURNING id, object_kind, object_id, attempts, unknown_outcomes,
				(extract(epoch FROM run_after) * ${MICROSECONDS_PER_SECOND})::bigint::text AS requested_at
		`
		if (row === undefined) {
			return undefined
		}
		return {
			id: row.id,
			objectKind: row.object_kind,
			objectId: row.object_id,
			attempts: row.attempts,
			unknownOutcomes: row.unknown_outcomes,
			requestedAt: row.requested_at,
		}
	}

	// ADR-016 ř. 54, datovy-model.md 4
	async renewLease(lease: QueueLease): Promise<boolean> {
		const renewed = await this.database.sql<{ id: string }[]>`
			UPDATE queue_task SET locked_until = now() + make_interval(secs => ${secondsOf(lease.leaseMilliseconds)})
			WHERE id = ${lease.taskId} AND locked_by = ${lease.lockedBy} AND state = ${JOB_STATE.RUNNING}
				AND locked_until > now()
			RETURNING id
		`
		return renewed.length > 0
	}

	// CAP-023-R25, datovy-model.md 4 „Úloha fronty“
	async isHeld(tx: postgres.TransactionSql, taskId: string, lockedBy: string): Promise<boolean> {
		const held = await tx<{ id: string }[]>`
			SELECT id FROM queue_task
			WHERE id = ${taskId} AND locked_by = ${lockedBy} AND state = ${JOB_STATE.RUNNING}
				AND locked_until > now()
			FOR UPDATE
		`
		return held.length > 0
	}

	// CAP-021-R36, CAP-021-R27
	async complete(tx: postgres.TransactionSql, taskId: string): Promise<void> {
		await tx`
			UPDATE queue_task SET state = ${JOB_STATE.DONE}, unknown_outcomes = 0, locked_by = NULL, locked_until = NULL
			WHERE id = ${taskId}
		`
	}

	// CAP-021-R31, CAP-021-R27
	async completeUnlessRequestedAgain(tx: postgres.TransactionSql, task: HeldQueueTask): Promise<void> {
		await tx`
			UPDATE queue_task SET
				state = CASE
					WHEN (extract(epoch FROM run_after) * ${MICROSECONDS_PER_SECOND})::bigint > ${task.requestedAt}::bigint THEN ${JOB_STATE.WAITING}
					ELSE ${JOB_STATE.DONE}
				END,
				unknown_outcomes = 0,
				locked_by = NULL,
				locked_until = NULL
			WHERE id = ${task.id}
		`
	}

	// CAP-021-R27, CAP-028-R15
	async fail(tx: postgres.TransactionSql, taskId: string): Promise<void> {
		await tx`
			UPDATE queue_task SET state = ${JOB_STATE.FAILED}, locked_by = NULL, locked_until = NULL
			WHERE id = ${taskId}
		`
	}

	// ADR-050 bod 10
	async retryLater(taskId: string, delayMilliseconds: number): Promise<void> {
		await this.waitAgain(this.database.sql, taskId, delayMilliseconds, this.database.sql`0`)
	}

	// CAP-023-R10, CAP-023-R23, CAP-023-R24
	async retryLaterWithin(tx: postgres.TransactionSql, taskId: string, delayMilliseconds: number): Promise<void> {
		await this.waitAgain(tx, taskId, delayMilliseconds, tx`0`)
	}

	// CAP-021-R27
	async retryAfterUnknownOutcome(taskId: string, delayMilliseconds: number): Promise<void> {
		await this.waitAgain(this.database.sql, taskId, delayMilliseconds, this.database.sql`unknown_outcomes + 1`)
	}

	private objectKindsOf(sql: postgres.Sql, objectKinds: readonly string[] | undefined): QueueCondition {
		if (objectKinds === undefined) {
			return sql`TRUE`
		}
		return sql`${sql(CLAIMED_TASK_ALIAS)}.object_kind IN ${sql([...objectKinds])}`
	}

	private async waitAgain(
		sql: postgres.Sql | postgres.TransactionSql,
		taskId: string,
		delayMilliseconds: number,
		unknownOutcomes: QueueCondition,
	): Promise<void> {
		await sql`
			UPDATE queue_task SET
				state = ${JOB_STATE.WAITING},
				run_after = GREATEST(run_after, now() + make_interval(secs => ${secondsOf(delayMilliseconds)})),
				unknown_outcomes = ${unknownOutcomes},
				locked_by = NULL,
				locked_until = NULL
			WHERE id = ${taskId}
		`
	}
}
