import type postgres from "@veevoy/postgres"
import type { FAILED_ATTEMPT_STEP, QUEUE_FAILURE } from "./failed-attempt"
import type { JobKind } from "./queue-task"

// ADR-016
export interface QueueDatabase {
	readonly sql: postgres.Sql
}

export type QueueCondition = postgres.PendingQuery<postgres.Row[]>

export type EpochMicroseconds = string

// datovy-model.md 4
export interface NewQueueTask<ObjectKind extends string = string> {
	kind: JobKind
	objectKind: ObjectKind
	objectId: string
}

// ADR-016 ř. 54, datovy-model.md 4
export interface QueueClaimRule<ObjectKind extends string = string> {
	kind: JobKind
	objectKinds: readonly [ObjectKind, ...ObjectKind[]] | undefined
	condition: QueueCondition | undefined
	// datovy-model.md 4 „Úloha fronty“ attempts
	countsAttempts: boolean
}

// CAP-021-R31
export interface HeldQueueTask {
	id: string
	requestedAt: EpochMicroseconds
}

// CAP-021-R27, ADR-050 bod 10
export interface AttemptedQueueTask {
	id: string
	attempts: number
	unknownOutcomes: number
}

export interface ClaimedQueueTask<ObjectKind extends string = string> extends HeldQueueTask, AttemptedQueueTask {
	objectKind: ObjectKind
	objectId: string
}

export interface ClaimedQueueTaskRow<ObjectKind extends string = string> {
	id: string
	object_kind: ObjectKind
	object_id: string
	attempts: number
	unknown_outcomes: number
	requested_at: EpochMicroseconds
}

// ADR-016 ř. 54
export interface QueueLease {
	taskId: string
	lockedBy: string
	leaseMilliseconds: number
}

// CAP-023-R25, datovy-model.md 4 „Úloha fronty“
export interface HeldQueueLease {
	readonly lockedBy: string
	readonly signal: AbortSignal
}

export interface QueueLoopTiming {
	// ADR-016 ř. 54
	leaseMilliseconds: number
	pollMilliseconds: number
}

export interface QueueLogger {
	log(message: string): void
	warn(message: string): void
	error(message: string, error?: unknown): void
}

export type QueueFailure = (typeof QUEUE_FAILURE)[keyof typeof QUEUE_FAILURE]

// ADR-050 bod 10, CAP-021-R27
export type FailedAttemptStep =
	| { kind: typeof FAILED_ATTEMPT_STEP.FAIL }
	| { kind: typeof FAILED_ATTEMPT_STEP.FAIL_AFTER_UNKNOWN_OUTCOMES; unknownOutcomes: number }
	| { kind: typeof FAILED_ATTEMPT_STEP.RETRY_LATER; delayMilliseconds: number }
	| { kind: typeof FAILED_ATTEMPT_STEP.RETRY_AFTER_UNKNOWN_OUTCOME; delayMilliseconds: number; unknownOutcomes: number }
