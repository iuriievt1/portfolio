import { describe, expect, it } from "vitest"
import type { QueueCondition } from "../queue.types"
import { JOB_KIND, JOB_OBJECT_KIND, JOB_STATE } from "../queue-task"
import { CLAIMED_TASK_ALIAS, QueueTaskStore } from "../queue-task-store"
import { fakeSql } from "./fake-sql"

const TASK_ID = "33333333-3333-4333-8333-333333333333"
const OBJECT_ID = "44444444-4444-4444-8444-444444444444"
const LOCKED_BY = "worker-host:42"
const LEASE_MILLISECONDS = 120_000
const LEASE_SECONDS = 120
const DELAY_MILLISECONDS = 5000
const DELAY_SECONDS = 5
const REQUESTED_AT = "1791363600123456"
const CLAIMED_ROW = {
	id: TASK_ID,
	object_kind: JOB_OBJECT_KIND.IMAGE,
	object_id: OBJECT_ID,
	attempts: 2,
	unknown_outcomes: 1,
	requested_at: REQUESTED_AT,
}
const COPY_FINISHED_FIRST = { condition: "copy finished first" } as unknown as QueueCondition

function harness(answer: () => unknown[] = () => []) {
	const database = fakeSql(answer)
	return { ...database, store: new QueueTaskStore({ sql: database.sql }) }
}

describe("queue task store ADR-016, datovy-model.md 4", () => {
	it("CAP-021-R31 merges a repeated request with the open task of the same object", async () => {
		const run = harness()

		await run.store.enqueue(run.sql, {
			kind: JOB_KIND.CLINICAL_RECORD_WRITE,
			objectKind: JOB_OBJECT_KIND.ACTOR,
			objectId: OBJECT_ID,
		})

		const insert = run.statementStartingWith("INSERT INTO queue_task")
		expect(insert.text).toContain("ON CONFLICT (kind, object_kind, object_id) WHERE state IN ('waiting', 'running')")
		expect(insert.text).toContain("DO UPDATE SET run_after = CASE WHEN queue_task.state = ? THEN now()")
		expect(insert.values.slice(1)).toEqual([
			JOB_KIND.CLINICAL_RECORD_WRITE,
			JOB_OBJECT_KIND.ACTOR,
			OBJECT_ID,
			JOB_STATE.WAITING,
			JOB_STATE.RUNNING,
		])
	})

	it("ADR-016 ř. 54 claims a waiting task or a running one whose lease expired, skipping rows locked by another run", async () => {
		const run = harness()

		await run.store.claim(
			{ kind: JOB_KIND.CLINICAL_RECORD_WRITE, objectKinds: undefined, condition: undefined, countsAttempts: true },
			LOCKED_BY,
			LEASE_MILLISECONDS,
		)

		const claim = run.statementStartingWith("UPDATE queue_task SET state")
		expect(claim.text).toContain("locked_until = now() + make_interval(secs => ?)")
		expect(claim.text).toContain("run_after <= now()")
		expect(claim.text).toContain("locked_until < now()")
		expect(claim.text).toContain("FOR UPDATE SKIP LOCKED")
		expect(claim.values).toEqual(expect.arrayContaining([JOB_STATE.RUNNING, LOCKED_BY, LEASE_SECONDS]))
		expect(claim.values).toContainEqual({ helper: CLAIMED_TASK_ALIAS })
	})

	it("ADR-016 ř. 54 counts every claim as an attempt unless the rule keeps the attempts elsewhere", async () => {
		const counted = harness()
		const uncounted = harness()

		await counted.store.claim(
			{ kind: JOB_KIND.ASSEMBLY, objectKinds: undefined, condition: undefined, countsAttempts: true },
			LOCKED_BY,
			LEASE_MILLISECONDS,
		)
		await uncounted.store.claim(
			{ kind: JOB_KIND.DELIVERY, objectKinds: undefined, condition: undefined, countsAttempts: false },
			LOCKED_BY,
			LEASE_MILLISECONDS,
		)

		expect(counted.statementStartingWith("UPDATE queue_task SET state").values.slice(0, 3)).toEqual([
			JOB_STATE.RUNNING,
			1,
			LOCKED_BY,
		])
		expect(uncounted.statementStartingWith("UPDATE queue_task SET state").values.slice(0, 3)).toEqual([
			JOB_STATE.RUNNING,
			0,
			LOCKED_BY,
		])
	})

	it("CAP-023-R25 holds a task only under its own unexpired lease and locks it for the result", async () => {
		const held = harness(() => [{ id: TASK_ID }])
		const lost = harness(() => [])
		expect(await held.store.isHeld(held.sql as never, TASK_ID, LOCKED_BY)).toBe(true)
		expect(await lost.store.isHeld(lost.sql as never, TASK_ID, LOCKED_BY)).toBe(false)
		const check = held.statementStartingWith("SELECT id FROM queue_task")
		expect(check.text).toContain("locked_by = ?")
		expect(check.text).toContain("locked_until > now()")
		expect(check.text).toContain("FOR UPDATE")
		expect(check.values).toEqual([TASK_ID, LOCKED_BY, JOB_STATE.RUNNING])
	})

	it("CAP-023-R24 lets a task wait again inside the transaction that settles it", async () => {
		const run = harness()

		await run.store.retryLaterWithin(run.sql as never, TASK_ID, DELAY_MILLISECONDS)

		const wait = run.statementStartingWith("UPDATE queue_task SET state")
		expect(wait.text).toContain("run_after = GREATEST(run_after, now() + make_interval(secs => ?))")
		expect(wait.values).toEqual(expect.arrayContaining([JOB_STATE.WAITING, DELAY_SECONDS, TASK_ID]))
	})

	it("claims only the listed object kinds", async () => {
		const run = harness()

		await run.store.claim(
			{
				kind: JOB_KIND.CLINICAL_RECORD_WRITE,
				objectKinds: [JOB_OBJECT_KIND.ACTOR],
				condition: undefined,
				countsAttempts: true,
			},
			LOCKED_BY,
			LEASE_MILLISECONDS,
		)

		expect(run.statementStartingWith("?.object_kind IN ?").values).toEqual([
			{ helper: CLAIMED_TASK_ALIAS },
			{ helper: [JOB_OBJECT_KIND.ACTOR] },
		])
	})

	it("CAP-021-R40 adds the condition of the queue to the claim", async () => {
		const run = harness()

		await run.store.claim(
			{
				kind: JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD,
				objectKinds: undefined,
				condition: COPY_FINISHED_FIRST,
				countsAttempts: true,
			},
			LOCKED_BY,
			LEASE_MILLISECONDS,
		)

		const claim = run.statementStartingWith("UPDATE queue_task SET state")
		expect(claim.values).toContain(COPY_FINISHED_FIRST)
		expect(claim.values).toContain(JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD)
	})

	it("returns the claimed task with its attempts, unknown outcomes and the moment it was requested", async () => {
		const run = harness(() => [CLAIMED_ROW])

		const task = await run.store.claim(
			{
				kind: JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD,
				objectKinds: undefined,
				condition: undefined,
				countsAttempts: true,
			},
			LOCKED_BY,
			LEASE_MILLISECONDS,
		)

		expect(task).toEqual({
			id: TASK_ID,
			objectKind: JOB_OBJECT_KIND.IMAGE,
			objectId: OBJECT_ID,
			attempts: 2,
			unknownOutcomes: 1,
			requestedAt: REQUESTED_AT,
		})
	})

	it("reports an empty queue", async () => {
		const run = harness()

		const task = await run.store.claim(
			{ kind: JOB_KIND.CLINICAL_RECORD_WRITE, objectKinds: undefined, condition: undefined, countsAttempts: true },
			LOCKED_BY,
			LEASE_MILLISECONDS,
		)

		expect(task).toBeUndefined()
	})

	it("ADR-016 ř. 54 renews the lease only of a running task this run still holds before the lease runs out", async () => {
		const run = harness(() => [{ id: TASK_ID }])

		const isRenewed = await run.store.renewLease({
			taskId: TASK_ID,
			lockedBy: LOCKED_BY,
			leaseMilliseconds: LEASE_MILLISECONDS,
		})

		const renewal = run.statementStartingWith("UPDATE queue_task SET locked_until")
		expect(renewal.text).toContain("WHERE id = ? AND locked_by = ? AND state = ?")
		expect(renewal.text).toContain("AND locked_until > now()")
		expect(renewal.values).toEqual([LEASE_SECONDS, TASK_ID, LOCKED_BY, JOB_STATE.RUNNING])
		expect(isRenewed).toBe(true)
	})

	it("ADR-016 ř. 54 reports a lease that is no longer held", async () => {
		const run = harness()

		const isRenewed = await run.store.renewLease({
			taskId: TASK_ID,
			lockedBy: LOCKED_BY,
			leaseMilliseconds: LEASE_MILLISECONDS,
		})

		expect(isRenewed).toBe(false)
	})

	it("CAP-021-R27 completes a task, clears its unknown outcomes and releases its lease", async () => {
		const run = harness()

		await run.store.complete(run.sql, TASK_ID)

		const completion = run.statementStartingWith("UPDATE queue_task SET state")
		expect(completion.text).toContain("unknown_outcomes = 0, locked_by = NULL, locked_until = NULL")
		expect(completion.values).toEqual([JOB_STATE.DONE, TASK_ID])
	})

	it("CAP-021-R31 sends a task requested again while it ran back to waiting instead of completing it", async () => {
		const run = harness()

		await run.store.completeUnlessRequestedAgain(run.sql, { id: TASK_ID, requestedAt: REQUESTED_AT })

		const completion = run.statementStartingWith("UPDATE queue_task SET state = CASE")
		expect(completion.text).toContain("::bigint > ?::bigint THEN ? ELSE ? END")
		expect(completion.text).toContain("unknown_outcomes = 0, locked_by = NULL, locked_until = NULL")
		expect(completion.values.slice(1)).toEqual([REQUESTED_AT, JOB_STATE.WAITING, JOB_STATE.DONE, TASK_ID])
	})

	it("CAP-021-R27 fails a task and releases its lease", async () => {
		const run = harness()

		await run.store.fail(run.sql, TASK_ID)

		const failure = run.statementStartingWith("UPDATE queue_task SET state")
		expect(failure.text).toContain("locked_by = NULL, locked_until = NULL")
		expect(failure.values).toEqual([JOB_STATE.FAILED, TASK_ID])
	})

	it("ADR-050 bod 10 lets a task wait again without moving a planned retry earlier and clears its unknown outcomes", async () => {
		const run = harness()

		await run.store.retryLater(TASK_ID, DELAY_MILLISECONDS)

		const retry = run.statementStartingWith("UPDATE queue_task SET state")
		expect(retry.text).toContain("run_after = GREATEST(run_after, now() + make_interval(secs => ?))")
		expect(retry.text).toContain("locked_by = NULL, locked_until = NULL")
		expect(retry.values).toEqual([JOB_STATE.WAITING, DELAY_SECONDS, expect.any(Promise), TASK_ID])
		expect(run.queries.map((query) => query.text)).toContain("0")
	})

	it("CAP-021-R27 counts an unknown outcome when the task waits again", async () => {
		const run = harness()

		await run.store.retryAfterUnknownOutcome(TASK_ID, DELAY_MILLISECONDS)

		expect(run.queries.map((query) => query.text)).toContain("unknown_outcomes + 1")
		expect(run.statementStartingWith("UPDATE queue_task SET state").values).toContain(DELAY_SECONDS)
	})
})
