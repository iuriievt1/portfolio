import type {
	AttemptedQueueTask,
	ClaimedQueueTask,
	FailedAttemptStep,
	HeldQueueLease,
	QueueClaimRule,
	QueueFailure,
	QueueLease,
	QueueLogger,
} from "../queue.types"
import { JOB_KIND, JOB_OBJECT_KIND } from "../queue-task"
import { QueueTaskLoop } from "../queue-task-loop"
import type { QueueTaskStore } from "../queue-task-store"

export const LEASE_MILLISECONDS = 120_000
export const RENEWAL_INTERVAL_MILLISECONDS = 40_000
export const POLL_MILLISECONDS = 5000
export const CONTEXT = "store"

export const RULE: QueueClaimRule = {
	kind: JOB_KIND.CLINICAL_RECORD_WRITE,
	objectKinds: [JOB_OBJECT_KIND.ACTOR],
	condition: undefined,
	countsAttempts: true,
}

export const TASK: ClaimedQueueTask = {
	id: "33333333-3333-4333-8333-333333333333",
	objectKind: JOB_OBJECT_KIND.ACTOR,
	objectId: "44444444-4444-4444-8444-444444444444",
	attempts: 1,
	unknownOutcomes: 0,
	requestedAt: "1791363600123456",
}

export interface LoggedLine {
	level: keyof QueueLogger
	message: string
}

export interface Claim {
	rule: QueueClaimRule
	lockedBy: string
	leaseMilliseconds: number
}

export interface Deferred<Value> {
	promise: Promise<Value>
	resolve: (value: Value) => void
	reject: (reason: unknown) => void
}

export function deferred<Value>(): Deferred<Value> {
	let resolve: (value: Value) => void = () => undefined
	let reject: (reason: unknown) => void = () => undefined
	const promise = new Promise<Value>((onResolve, onReject) => {
		resolve = onResolve
		reject = onReject
	})
	return { promise, resolve, reject }
}

export function recordingLogger(): QueueLogger & { lines: LoggedLine[] } {
	const lines: LoggedLine[] = []
	return {
		lines,
		log: (message: string) => void lines.push({ level: "log", message }),
		warn: (message: string) => void lines.push({ level: "warn", message }),
		error: (message: string) => void lines.push({ level: "error", message }),
	}
}

export interface FakeQueueOptions {
	claimed: readonly (ClaimedQueueTask | undefined)[]
	renew: (lease: QueueLease) => Promise<boolean>
}

export function fakeQueue(options: FakeQueueOptions) {
	const answers = [...options.claimed]
	const claims: Claim[] = []
	const renewals: QueueLease[] = []
	const steps: string[] = []
	const queue = {
		claim: async (rule: QueueClaimRule, lockedBy: string, leaseMilliseconds: number) => {
			claims.push({ rule, lockedBy, leaseMilliseconds })
			return answers.shift()
		},
		renewLease: async (lease: QueueLease) => {
			renewals.push(lease)
			return await options.renew(lease)
		},
		retryLater: async (taskId: string, delayMilliseconds: number) => {
			steps.push(`retry ${taskId} after ${delayMilliseconds}`)
		},
		retryAfterUnknownOutcome: async (taskId: string, delayMilliseconds: number) => {
			steps.push(`retry unknown ${taskId} after ${delayMilliseconds}`)
		},
	} as unknown as QueueTaskStore
	return { queue, claims, renewals, steps }
}

export interface TestLoopBehaviour {
	prepare: () => Promise<string | undefined>
	handle: (task: ClaimedQueueTask, context: string, lease: HeldQueueLease) => Promise<void>
}

// ADR-016 ř. 54
export class TestQueueLoop extends QueueTaskLoop<string, string> {
	readonly logger = recordingLogger()

	constructor(
		queue: QueueTaskStore,
		private readonly behaviour: TestLoopBehaviour,
	) {
		super(queue, { leaseMilliseconds: LEASE_MILLISECONDS, pollMilliseconds: POLL_MILLISECONDS })
	}

	async settle(
		task: AttemptedQueueTask,
		failure: QueueFailure,
		failForGood: () => Promise<void>,
	): Promise<FailedAttemptStep> {
		return await this.settleFailedAttempt(task, failure, failForGood)
	}

	protected claimRule(): QueueClaimRule {
		return RULE
	}

	protected async prepare(): Promise<string | undefined> {
		return await this.behaviour.prepare()
	}

	protected async handle(task: ClaimedQueueTask, context: string, lease: HeldQueueLease): Promise<void> {
		await this.behaviour.handle(task, context, lease)
	}
}
