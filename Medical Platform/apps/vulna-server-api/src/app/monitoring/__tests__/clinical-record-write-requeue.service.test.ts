import { ADMINISTRATION_ERROR_CODE, CLINICAL_RECORD_WRITE_OBJECT_KIND } from "@ansora/contracts"
import {
	AUDIT_ACTOR_KIND,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	JOB_KIND,
	JOB_STATE,
	PERMISSIONS,
} from "@ansora/core-server"
import { HttpStatus } from "@nestjs/common"
import postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { problemOf } from "../../encounter/__tests__/encounter-fixtures"
import type { AdministratorAlertRepository } from "../repositories/administrator-alert.repository"
import type { ClinicalRecordWriteTaskRepository } from "../repositories/clinical-record-write-task.repository"
import { ClinicalRecordWriteRequeueService } from "../services/clinical-record-write-requeue.service"
import type { WriteTaskRow } from "../types/monitoring.types"

const ADMINISTRATOR: AdministrationSession = {
	sessionId: "9e8d7c6b-5a49-4382-8170-6f5e4d3c2b1a",
	userId: "3f0d1c2e-5b6a-4c7d-8e9f-0a1b2c3d4e5f",
	permissions: PERMISSIONS,
}
const USER_ID = "22222222-2222-4222-8222-222222222222"
const OPEN_TASK_ID = "44444444-4444-4444-8444-444444444444"
const FILE_ID = "55555555-5555-4555-8555-555555555555"
const UNIQUE_VIOLATION = "23505"

const FAILED_TASK: WriteTaskRow = {
	id: "33333333-3333-4333-8333-333333333333",
	kind: JOB_KIND.CLINICAL_RECORD_WRITE,
	state: JOB_STATE.FAILED,
	object_kind: CLINICAL_RECORD_WRITE_OBJECT_KIND.ACTOR,
	object_id: USER_ID,
}

function uniqueViolation(): postgres.PostgresError {
	return Object.assign(new postgres.PostgresError("duplicate key"), { code: UNIQUE_VIOLATION })
}

function harness(options: { task?: WriteTaskRow | undefined; openTaskId?: string; racesOnce?: boolean } = {}) {
	const steps: string[] = []
	const audits: NewAuditEvent[] = []
	let races = options.racesOnce === true ? 1 : 0
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => await work({} as never) },
	} as unknown as DatabaseService
	const tasks = {
		lock: async (_tx: never, taskId: string) => {
			steps.push(`lock ${taskId}`)
			return "task" in options ? options.task : FAILED_TASK
		},
		openTaskOf: async () => options.openTaskId,
		revive: async (_tx: never, taskId: string) => {
			if (races > 0) {
				races -= 1
				throw uniqueViolation()
			}
			steps.push(`revive ${taskId}`)
		},
		hurry: async (_tx: never, taskId: string) => {
			steps.push(`hurry ${taskId}`)
		},
		closeMerged: async (_tx: never, taskId: string) => {
			steps.push(`close ${taskId}`)
		},
	} as unknown as ClinicalRecordWriteTaskRepository
	const alerts = {
		handOver: async (_tx: never, from: string, to: string) => {
			steps.push(`hand over ${from} to ${to}`)
		},
	} as unknown as AdministratorAlertRepository
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audits.push(event)
		},
	} as unknown as AuditRepository
	return { service: new ClinicalRecordWriteRequeueService(database, tasks, alerts, audit), steps, audits }
}

describe("requeue of a permanently failed clinical record write CAP-021-R27", () => {
	it("CAP-021-S25 returns the failed write to the queue and audits the requeue without clinical content", async () => {
		const run = harness()

		await run.service.requeue(FAILED_TASK.id, ADMINISTRATOR)

		expect(run.steps).toEqual([`lock ${FAILED_TASK.id}`, `revive ${FAILED_TASK.id}`])
		expect(run.audits).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.CLINICAL_RECORD_WRITE_REQUEUED,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: ADMINISTRATOR.userId,
				objectId: FAILED_TASK.id,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: {
					administrator_user_id: ADMINISTRATOR.userId,
					object_kind: CLINICAL_RECORD_WRITE_OBJECT_KIND.ACTOR,
					object_id: USER_ID,
				},
			},
		])
	})

	it("CAP-021-R31 merges the requeue into the open write of the same object and hands the alert over", async () => {
		const run = harness({ openTaskId: OPEN_TASK_ID })

		await run.service.requeue(FAILED_TASK.id, ADMINISTRATOR)

		expect(run.steps).toEqual([
			`lock ${FAILED_TASK.id}`,
			`hurry ${OPEN_TASK_ID}`,
			`close ${FAILED_TASK.id}`,
			`hand over ${FAILED_TASK.id} to ${OPEN_TASK_ID}`,
		])
		expect(run.audits).toHaveLength(1)
	})

	it("CAP-021-S25 returns a failed upload to the queue under the same action and audits its file", async () => {
		const upload = {
			...FAILED_TASK,
			kind: JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD,
			object_kind: CLINICAL_RECORD_WRITE_OBJECT_KIND.IMAGE,
			object_id: FILE_ID,
		}
		const run = harness({ task: upload })

		await run.service.requeue(upload.id, ADMINISTRATOR)

		expect(run.steps).toEqual([`lock ${upload.id}`, `revive ${upload.id}`])
		expect(run.audits[0]?.details).toEqual({
			administrator_user_id: ADMINISTRATOR.userId,
			object_kind: CLINICAL_RECORD_WRITE_OBJECT_KIND.IMAGE,
			object_id: FILE_ID,
		})
	})

	it("refuses a write that has not failed with clinical-record-write-not-failed", async () => {
		const run = harness({ task: { ...FAILED_TASK, state: JOB_STATE.WAITING } })

		const problem = await problemOf(run.service.requeue(FAILED_TASK.id, ADMINISTRATOR))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.CLINICAL_RECORD_WRITE_NOT_FAILED)
		expect(run.audits).toEqual([])
	})

	it("answers not found for a task that is no clinical record write", async () => {
		const run = harness({ task: undefined })

		const problem = await problemOf(run.service.requeue(FAILED_TASK.id, ADMINISTRATOR))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
		expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.NOT_FOUND)
		expect(run.audits).toEqual([])
	})

	it("tries once more when a new write of the same object is queued at the same moment", async () => {
		const run = harness({ racesOnce: true })

		await run.service.requeue(FAILED_TASK.id, ADMINISTRATOR)

		expect(run.steps).toEqual([`lock ${FAILED_TASK.id}`, `lock ${FAILED_TASK.id}`, `revive ${FAILED_TASK.id}`])
		expect(run.audits).toHaveLength(1)
	})
})
