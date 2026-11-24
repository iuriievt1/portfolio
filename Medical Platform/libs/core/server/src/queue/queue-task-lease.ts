import type { HeldQueueLease, QueueLease, QueueLogger } from "./queue.types"
import type { QueueTaskStore } from "./queue-task-store"

// ADR-016 ř. 54
const RENEWALS_PER_LEASE = 3

// CAP-023-R25, datovy-model.md 4 „Úloha fronty“
export class QueueLeaseLostError extends Error {
	constructor(taskId: string) {
		super(`The lease of task ${taskId} is lost`)
		this.name = "QueueLeaseLostError"
	}
}

// ADR-016 ř. 54, CAP-023-R25, datovy-model.md 4
export class QueueTaskLease implements HeldQueueLease {
	private timer: NodeJS.Timeout | undefined
	private deadline: NodeJS.Timeout | undefined
	private isRenewing = false
	private readonly controller = new AbortController()

	constructor(
		private readonly queue: QueueTaskStore,
		private readonly logger: QueueLogger,
		private readonly lease: QueueLease,
		private readonly claimedAt: number,
	) {}

	get lockedBy(): string {
		return this.lease.lockedBy
	}

	get signal(): AbortSignal {
		return this.controller.signal
	}

	startRenewing(): void {
		this.isRenewing = true
		this.holdUntilLeaseEndsFrom(this.claimedAt)
		this.timer = setInterval(() => this.renewInBackground(), this.lease.leaseMilliseconds / RENEWALS_PER_LEASE)
	}

	stopRenewing(): void {
		this.isRenewing = false
		clearInterval(this.timer)
		clearTimeout(this.deadline)
	}

	private renewInBackground(): void {
		this.renew().catch((error: unknown) => {
			this.logger.error(`Renewing the lease of task ${this.lease.taskId} failed`, error)
		})
	}

	private async renew(): Promise<void> {
		const requestedAt = performance.now()
		const isRenewed = await this.queue.renewLease(this.lease)
		if (!this.isRenewing) {
			return
		}
		if (isRenewed) {
			this.holdUntilLeaseEndsFrom(requestedAt)
			return
		}
		this.lose(`Task ${this.lease.taskId} is no longer held by ${this.lease.lockedBy}; its lease is not renewed`)
	}

	// CAP-023-R25
	private holdUntilLeaseEndsFrom(start: number): void {
		clearTimeout(this.deadline)
		const remaining = Math.max(0, start + this.lease.leaseMilliseconds - performance.now())
		this.deadline = setTimeout(
			() => this.lose(`The lease of task ${this.lease.taskId} ran out before a renewal was confirmed`),
			remaining,
		)
	}

	private lose(message: string): void {
		this.stopRenewing()
		this.logger.warn(message)
		this.controller.abort(new QueueLeaseLostError(this.lease.taskId))
	}
}
