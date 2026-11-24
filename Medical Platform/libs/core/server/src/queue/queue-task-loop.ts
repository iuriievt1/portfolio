import { randomUUID } from "node:crypto"
import { hostname } from "node:os"
import { FAILED_ATTEMPT_STEP, stepAfterFailedAttempt } from "./failed-attempt"
import type {
	AttemptedQueueTask,
	ClaimedQueueTask,
	FailedAttemptStep,
	HeldQueueLease,
	QueueClaimRule,
	QueueFailure,
	QueueLogger,
	QueueLoopTiming,
} from "./queue.types"
import { QueueTaskLease } from "./queue-task-lease"
import type { QueueTaskStore } from "./queue-task-store"

const FIRST_POLL_DELAY_MILLISECONDS = 0

// ADR-016 ř. 54, ADR-050 bod 10, datovy-model.md 4
export abstract class QueueTaskLoop<ObjectKind extends string, Context> {
	protected abstract readonly logger: QueueLogger
	// datovy-model.md 4 „Převzetí“
	private readonly lockedBy = `${hostname()}:${process.pid}:${randomUUID()}`
	private timer: NodeJS.Timeout | undefined
	private isStopped = false

	protected constructor(
		protected readonly queue: QueueTaskStore,
		private readonly timing: QueueLoopTiming,
	) {}

	startPolling(): void {
		this.schedule(FIRST_POLL_DELAY_MILLISECONDS)
	}

	stopPolling(): void {
		this.isStopped = true
		clearTimeout(this.timer)
	}

	async runNext(): Promise<boolean> {
		const context = await this.prepare()
		if (context === undefined) {
			return false
		}
		const claimedAt = performance.now()
		const task = await this.queue.claim(this.claimRule(), this.lockedBy, this.timing.leaseMilliseconds)
		if (task === undefined) {
			return false
		}
		await this.handleHoldingLease(task, context, claimedAt)
		return true
	}

	protected abstract claimRule(): QueueClaimRule<ObjectKind>

	protected abstract prepare(): Promise<Context | undefined>

	protected abstract handle(task: ClaimedQueueTask<ObjectKind>, context: Context, lease: HeldQueueLease): Promise<void>

	// ADR-050 bod 10, CAP-021-R27, CAP-001-S34
	protected async settleFailedAttempt(
		task: AttemptedQueueTask,
		failure: QueueFailure,
		failForGood: () => Promise<void>,
	): Promise<FailedAttemptStep> {
		const step = stepAfterFailedAttempt(task, failure)
		switch (step.kind) {
			case FAILED_ATTEMPT_STEP.FAIL:
			case FAILED_ATTEMPT_STEP.FAIL_AFTER_UNKNOWN_OUTCOMES:
				await failForGood()
				return step
			case FAILED_ATTEMPT_STEP.RETRY_LATER:
				await this.queue.retryLater(task.id, step.delayMilliseconds)
				return step
			case FAILED_ATTEMPT_STEP.RETRY_AFTER_UNKNOWN_OUTCOME:
				await this.queue.retryAfterUnknownOutcome(task.id, step.delayMilliseconds)
				return step
			default:
				return step satisfies never
		}
	}

	// ADR-016 ř. 54, CAP-023-R25
	private async handleHoldingLease(
		task: ClaimedQueueTask<ObjectKind>,
		context: Context,
		claimedAt: number,
	): Promise<void> {
		const lease = new QueueTaskLease(
			this.queue,
			this.logger,
			{ taskId: task.id, lockedBy: this.lockedBy, leaseMilliseconds: this.timing.leaseMilliseconds },
			claimedAt,
		)
		lease.startRenewing()
		try {
			await this.handle(task, context, lease)
		} finally {
			lease.stopRenewing()
		}
	}

	private schedule(delayMilliseconds: number): void {
		if (this.isStopped) {
			return
		}
		this.timer = setTimeout(() => void this.tick(), delayMilliseconds)
	}

	private async tick(): Promise<void> {
		try {
			while (!this.isStopped && (await this.runNext())) {}
		} catch (error) {
			this.logger.error("The queue cycle failed", error)
		}
		this.schedule(this.timing.pollMilliseconds)
	}
}
