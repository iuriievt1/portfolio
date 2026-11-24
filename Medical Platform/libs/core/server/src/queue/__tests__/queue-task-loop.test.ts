import { hostname } from "node:os"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAILED_ATTEMPT_STEP, QUEUE_FAILURE } from "../failed-attempt"
import type { ClaimedQueueTask, QueueLease } from "../queue.types"
import { UNKNOWN_OUTCOMES_BEFORE_FAILURE } from "../queue-task"
import { QueueLeaseLostError } from "../queue-task-lease"
import {
	CONTEXT,
	deferred,
	fakeQueue,
	LEASE_MILLISECONDS,
	POLL_MILLISECONDS,
	RENEWAL_INTERVAL_MILLISECONDS,
	RULE,
	TASK,
	type TestLoopBehaviour,
	TestQueueLoop,
} from "./queue-loop-fixtures"

const OTHER_TASK: ClaimedQueueTask = { ...TASK, id: "55555555-5555-4555-8555-555555555555" }
const HOLDER = new RegExp(`^${hostname()}:${process.pid}:[0-9a-f-]{36}$`)
const RENEWALS_BEFORE_SETTLING = 2
const POLLS_AFTER_SHUTDOWN = 3
const SLOW_CLAIM_MILLISECONDS = 10_000

interface HarnessOptions {
	claimed?: readonly (ClaimedQueueTask | undefined)[]
	renew?: (lease: QueueLease) => Promise<boolean>
	behaviour?: Partial<TestLoopBehaviour>
}

function harness(options: HarnessOptions = {}) {
	const handled: { task: ClaimedQueueTask; context: string }[] = []
	const queue = fakeQueue({ claimed: options.claimed ?? [TASK], renew: options.renew ?? (async () => true) })
	const loop = new TestQueueLoop(queue.queue, {
		prepare: async () => CONTEXT,
		handle: async (task, context) => void handled.push({ task, context }),
		...options.behaviour,
	})
	return { ...queue, loop, handled, logged: loop.logger.lines }
}

describe("queue task loop ADR-016 ř. 54, ADR-050 bod 10", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it("ADR-016 ř. 54 claims under the identity of this run with the lease of its queue and hands over the task", async () => {
		const run = harness()

		expect(await run.loop.runNext()).toBe(true)

		expect(run.claims).toEqual([
			{ rule: RULE, lockedBy: expect.stringMatching(HOLDER), leaseMilliseconds: LEASE_MILLISECONDS },
		])
		expect(run.handled).toEqual([{ task: TASK, context: CONTEXT }])
	})

	it("datovy-model.md 4 claims under an identity of its own run, not of the process", async () => {
		const first = harness()
		const second = harness()

		await first.loop.runNext()
		await second.loop.runNext()

		expect(first.claims[0]?.lockedBy).not.toBe(second.claims[0]?.lockedBy)
	})

	it("claims nothing while the loop is not ready", async () => {
		const run = harness({ behaviour: { prepare: async () => undefined } })

		expect(await run.loop.runNext()).toBe(false)

		expect(run.claims).toEqual([])
	})

	it("reports an empty queue so the cycle waits", async () => {
		const run = harness({ claimed: [] })

		expect(await run.loop.runNext()).toBe(false)

		expect(run.handled).toEqual([])
	})

	it("ADR-016 ř. 54 renews the lease every third of it while the task is handled", async () => {
		vi.useFakeTimers()
		const handling = deferred<undefined>()
		const run = harness({ behaviour: { handle: async () => await handling.promise } })

		const running = run.loop.runNext()
		await vi.advanceTimersByTimeAsync(RENEWAL_INTERVAL_MILLISECONDS * RENEWALS_BEFORE_SETTLING)
		handling.resolve(undefined)
		await running

		const lease = { taskId: TASK.id, lockedBy: run.claims[0]?.lockedBy, leaseMilliseconds: LEASE_MILLISECONDS }
		expect(run.renewals).toEqual([lease, lease])
	})

	it("ADR-016 ř. 54 stops renewing the lease once the task is settled", async () => {
		vi.useFakeTimers()
		const run = harness()

		await run.loop.runNext()
		await vi.advanceTimersByTimeAsync(LEASE_MILLISECONDS)

		expect(run.renewals).toEqual([])
	})

	it("ADR-016 ř. 54 stops renewing the lease when the handler throws", async () => {
		vi.useFakeTimers()
		const handling = deferred<undefined>()
		const run = harness({ behaviour: { handle: async () => await handling.promise } })

		const running = run.loop.runNext()
		await vi.advanceTimersByTimeAsync(RENEWAL_INTERVAL_MILLISECONDS)
		handling.reject(new Error("the handler failed"))
		await expect(running).rejects.toThrow("the handler failed")
		await vi.advanceTimersByTimeAsync(LEASE_MILLISECONDS)

		expect(run.renewals).toHaveLength(1)
	})

	it("ADR-016 ř. 54 warns with the task id and stops renewing when the lease is lost", async () => {
		vi.useFakeTimers()
		const handling = deferred<undefined>()
		const run = harness({ renew: async () => false, behaviour: { handle: async () => await handling.promise } })

		const running = run.loop.runNext()
		await vi.advanceTimersByTimeAsync(LEASE_MILLISECONDS)
		handling.resolve(undefined)
		await running

		expect(run.renewals).toHaveLength(1)
		expect(run.logged).toEqual([{ level: "warn", message: expect.stringContaining(TASK.id) }])
	})

	it("CAP-023-R25 aborts the work held under a lease that is lost", async () => {
		vi.useFakeTimers()
		const aborted: unknown[] = []
		const run = harness({
			renew: async () => false,
			behaviour: {
				handle: async (_task, _context, lease) =>
					await new Promise<void>((resolve) => {
						lease.signal.addEventListener("abort", () => {
							aborted.push(lease.signal.reason)
							resolve()
						})
					}),
			},
		})

		const running = run.loop.runNext()
		await vi.advanceTimersByTimeAsync(RENEWAL_INTERVAL_MILLISECONDS)
		await running

		expect(aborted).toEqual([expect.any(QueueLeaseLostError)])
	})

	it("CAP-023-R25 aborts the work when the lease runs out before a renewal is confirmed", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"] })
		const renewal = deferred<boolean>()
		const run = harness({
			renew: async () => await renewal.promise,
			behaviour: {
				handle: async (_task, _context, lease) =>
					await new Promise<void>((resolve) => lease.signal.addEventListener("abort", () => resolve())),
			},
		})

		const running = run.loop.runNext()
		await vi.advanceTimersByTimeAsync(LEASE_MILLISECONDS)
		await running

		expect(run.logged).toEqual([{ level: "warn", message: expect.stringContaining("ran out before a renewal") }])
	})

	it("CAP-023-R25 counts the lease from the claim, so a slow claim shortens the work", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"] })
		const renewal = deferred<boolean>()
		let abortedAt: number | undefined
		const run = harness({
			renew: async () => await renewal.promise,
			behaviour: {
				handle: async (_task, _context, lease) =>
					await new Promise<void>((resolve) =>
						lease.signal.addEventListener("abort", () => {
							abortedAt = performance.now()
							resolve()
						}),
					),
			},
		})
		const claim = run.queue.claim.bind(run.queue)
		run.queue.claim = async (...args) => {
			await new Promise((resolve) => setTimeout(resolve, SLOW_CLAIM_MILLISECONDS))
			return await claim(...args)
		}
		const startedAt = performance.now()

		const running = run.loop.runNext()
		await vi.advanceTimersByTimeAsync(LEASE_MILLISECONDS)
		await running

		expect(abortedAt).toBe(startedAt + LEASE_MILLISECONDS)
	})

	it("CAP-023-R25 keeps the work going while every renewal is confirmed", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"] })
		const handling = deferred<undefined>()
		let signal: AbortSignal | undefined
		const run = harness({
			behaviour: {
				handle: async (_task, _context, lease) => {
					signal = lease.signal
					await handling.promise
				},
			},
		})

		const running = run.loop.runNext()
		await vi.advanceTimersByTimeAsync(LEASE_MILLISECONDS * RENEWALS_BEFORE_SETTLING)
		handling.resolve(undefined)
		await running

		expect(signal?.aborted).toBe(false)
		expect(run.logged).toEqual([])
	})

	it("does not warn about a renewal answered after the task settled", async () => {
		vi.useFakeTimers()
		const handling = deferred<undefined>()
		const renewal = deferred<boolean>()
		const run = harness({
			renew: async () => await renewal.promise,
			behaviour: { handle: async () => await handling.promise },
		})

		const running = run.loop.runNext()
		await vi.advanceTimersByTimeAsync(RENEWAL_INTERVAL_MILLISECONDS)
		handling.resolve(undefined)
		await running
		renewal.resolve(false)
		await vi.advanceTimersByTimeAsync(0)

		expect(run.logged).toEqual([])
	})

	it("logs a failed renewal with the task id and renews again at the next third of the lease", async () => {
		vi.useFakeTimers()
		const handling = deferred<undefined>()
		let renewals = 0
		const run = harness({
			renew: async () => {
				renewals += 1
				if (renewals === 1) {
					throw new Error("the database is not reachable")
				}
				return true
			},
			behaviour: { handle: async () => await handling.promise },
		})

		const running = run.loop.runNext()
		await vi.advanceTimersByTimeAsync(RENEWAL_INTERVAL_MILLISECONDS * RENEWALS_BEFORE_SETTLING)
		handling.resolve(undefined)
		await running

		expect(run.renewals).toHaveLength(RENEWALS_BEFORE_SETTLING)
		expect(run.logged).toEqual([{ level: "error", message: expect.stringContaining(TASK.id) }])
	})

	it("ADR-050 bod 10 fails a task whose attempt failed for good, without a retry", async () => {
		const run = harness()
		const failed: string[] = []

		const step = await run.loop.settle(TASK, QUEUE_FAILURE.PERMANENT, async () => void failed.push(TASK.id))

		expect(step).toEqual({ kind: FAILED_ATTEMPT_STEP.FAIL })
		expect(failed).toEqual([TASK.id])
		expect(run.steps).toEqual([])
	})

	it("CAP-001-S34 lets a task wait and retry after a transient failure", async () => {
		const run = harness()

		const step = await run.loop.settle(TASK, QUEUE_FAILURE.TRANSIENT, async () => undefined)

		expect(step).toEqual({ kind: FAILED_ATTEMPT_STEP.RETRY_LATER, delayMilliseconds: expect.any(Number) })
		expect(run.steps).toEqual([expect.stringMatching(`^retry ${TASK.id} after \\d+$`)])
	})

	it("CAP-021-R27 counts an unknown outcome and retries", async () => {
		const run = harness()

		const step = await run.loop.settle(TASK, QUEUE_FAILURE.UNKNOWN_OUTCOME, async () => undefined)

		expect(step).toEqual({
			kind: FAILED_ATTEMPT_STEP.RETRY_AFTER_UNKNOWN_OUTCOME,
			delayMilliseconds: expect.any(Number),
			unknownOutcomes: 1,
		})
		expect(run.steps).toEqual([expect.stringMatching(`^retry unknown ${TASK.id} after`)])
	})

	it("CAP-021-S25 fails a task whose outcome stayed unknown ten times in a row", async () => {
		const run = harness()
		const failed: string[] = []
		const task = { ...TASK, unknownOutcomes: UNKNOWN_OUTCOMES_BEFORE_FAILURE - 1 }

		const step = await run.loop.settle(task, QUEUE_FAILURE.UNKNOWN_OUTCOME, async () => void failed.push(task.id))

		expect(step).toEqual({
			kind: FAILED_ATTEMPT_STEP.FAIL_AFTER_UNKNOWN_OUTCOMES,
			unknownOutcomes: UNKNOWN_OUTCOMES_BEFORE_FAILURE,
		})
		expect(failed).toEqual([task.id])
		expect(run.steps).toEqual([])
	})

	it("drains the queue, polls again after the poll interval and stops on shutdown", async () => {
		vi.useFakeTimers()
		const run = harness({ claimed: [TASK, OTHER_TASK] })

		run.loop.startPolling()
		await vi.advanceTimersByTimeAsync(0)
		expect(run.handled.map((handled) => handled.task)).toEqual([TASK, OTHER_TASK])
		expect(run.claims).toHaveLength(3)

		await vi.advanceTimersByTimeAsync(POLL_MILLISECONDS)
		expect(run.claims).toHaveLength(4)

		run.loop.stopPolling()
		await vi.advanceTimersByTimeAsync(POLL_MILLISECONDS * POLLS_AFTER_SHUTDOWN)
		expect(run.claims).toHaveLength(4)
	})

	it("logs a failed cycle and keeps polling", async () => {
		vi.useFakeTimers()
		let preparations = 0
		const run = harness({
			behaviour: {
				prepare: async () => {
					preparations += 1
					throw new Error("the configuration cannot be read")
				},
			},
		})

		run.loop.startPolling()
		await vi.advanceTimersByTimeAsync(POLL_MILLISECONDS)
		run.loop.stopPolling()

		expect(preparations).toBe(2)
		expect(run.logged).toEqual([
			{ level: "error", message: "The queue cycle failed" },
			{ level: "error", message: "The queue cycle failed" },
		])
	})
})
