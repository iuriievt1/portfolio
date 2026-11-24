import { ADMINISTRATOR_ALERT_KIND, SYSTEM_JOB } from "@ansora/contracts"
import {
	AUDIT_ACTOR_KIND,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	JOB_KIND,
	JOB_OBJECT_KIND,
	JOB_STATE,
} from "@ansora/core-server"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import { WRITE_FAILURE_MESSAGE } from "../constants/clinical-record.constants"
import { ActorTaskRepository } from "../repositories/actor-task.repository"
import { CodeListSetTaskRepository } from "../repositories/code-list-set-task.repository"
import type { ClaimedWriteTask } from "../types/clinical-record.types"

const TASK: ClaimedWriteTask = {
	id: "33333333-3333-4333-8333-333333333333",
	objectId: "44444444-4444-4444-8444-444444444444",
	attempts: 1,
	unknownOutcomes: 0,
	requestedAt: "1791363600123456",
}
const ALERT_ID = "55555555-5555-4555-8555-555555555555"

interface AlertCall {
	tx: postgres.TransactionSql
	taskId: string
	message?: string
}

function harness(options: { isAlreadyActive?: boolean } = {}) {
	const updates: postgres.TransactionSql[] = []
	const raised: AlertCall[] = []
	const resolved: AlertCall[] = []
	const audits: { tx: postgres.TransactionSql; event: NewAuditEvent }[] = []
	const tx = (() => {
		updates.push(tx)
		return Promise.resolve([])
	}) as unknown as postgres.TransactionSql
	const database = {
		sql: { begin: async (work: (transaction: postgres.TransactionSql) => Promise<unknown>) => await work(tx) },
	} as unknown as DatabaseService
	const alerts = {
		raiseForFailedWrite: async (transaction: postgres.TransactionSql, taskId: string, message: string) => {
			raised.push({ tx: transaction, taskId, message })
			return options.isAlreadyActive === true ? undefined : ALERT_ID
		},
		resolveForTask: async (transaction: postgres.TransactionSql, taskId: string) => {
			resolved.push({ tx: transaction, taskId })
		},
	} as unknown as AdministratorAlertRepository
	const audit = {
		append: async (transaction: postgres.TransactionSql, event: NewAuditEvent) => {
			audits.push({ tx: transaction, event })
		},
	} as unknown as AuditRepository
	return { database, alerts, audit, tx, updates, raised, resolved, audits }
}

describe("write task and the administrator alert CAP-021-R27", () => {
	it("CAP-021-S25 raises the alert in the transaction that marks the write failed", async () => {
		const run = harness()

		await new ActorTaskRepository(run.database, run.alerts, run.audit).fail(TASK)

		expect(run.updates).toEqual([run.tx])
		expect(run.raised).toEqual([{ tx: run.tx, taskId: TASK.id, message: WRITE_FAILURE_MESSAGE[JOB_OBJECT_KIND.ACTOR] }])
	})

	it("CAP-028-R15 records the new alert in the audit trail for Syslog in the same transaction", async () => {
		const run = harness()

		await new ActorTaskRepository(run.database, run.alerts, run.audit).fail(TASK)

		expect(run.audits).toEqual([
			{
				tx: run.tx,
				event: {
					eventType: AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED,
					actorKind: AUDIT_ACTOR_KIND.SYSTEM_JOB,
					systemJob: SYSTEM_JOB.CLINICAL_RECORD_WRITE,
					objectId: ALERT_ID,
					outcome: AUDIT_OUTCOME.FAILURE,
					details: {
						alert_id: ALERT_ID,
						alert_kind: ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_WRITE_FAILED,
						message: WRITE_FAILURE_MESSAGE[JOB_OBJECT_KIND.ACTOR],
						task_id: TASK.id,
						object_kind: JOB_OBJECT_KIND.ACTOR,
						object_id: TASK.objectId,
					},
				},
			},
		])
	})

	it("does not record the alert again while it is still active", async () => {
		const run = harness({ isAlreadyActive: true })

		await new ActorTaskRepository(run.database, run.alerts, run.audit).fail(TASK)

		expect(run.audits).toEqual([])
	})

	it("names the publication of code lists in the alert of a failed code list write", async () => {
		const run = harness()

		await new CodeListSetTaskRepository(run.database, run.alerts, run.audit).fail(TASK)

		expect(run.raised[0]?.message).toBe(WRITE_FAILURE_MESSAGE[JOB_OBJECT_KIND.CODE_LIST_SET])
	})

	it("resolves the alert in the transaction that completes the write", async () => {
		const run = harness()

		await new ActorTaskRepository(run.database, run.alerts, run.audit).complete(TASK)

		expect(run.updates).toEqual([run.tx])
		expect(run.resolved).toEqual([{ tx: run.tx, taskId: TASK.id }])
	})

	it("CAP-021-R31 queues the write of its object kind so that it merges with the open task of the object", async () => {
		const run = harness()
		const statements: { text: string; values: unknown[] }[] = []
		const tx = ((text: TemplateStringsArray, ...values: unknown[]) => {
			statements.push({ text: text.join("?").replace(/\s+/g, " ").trim(), values })
			return Promise.resolve([])
		}) as unknown as postgres.TransactionSql

		await new ActorTaskRepository(run.database, run.alerts, run.audit).enqueue(tx, TASK.objectId)

		expect(statements[0]?.text).toContain(
			"ON CONFLICT (kind, object_kind, object_id) WHERE state IN ('waiting', 'running')",
		)
		expect(statements[0]?.values.slice(1)).toEqual([
			JOB_KIND.CLINICAL_RECORD_WRITE,
			JOB_OBJECT_KIND.ACTOR,
			TASK.objectId,
			JOB_STATE.WAITING,
			JOB_STATE.RUNNING,
		])
	})
})
