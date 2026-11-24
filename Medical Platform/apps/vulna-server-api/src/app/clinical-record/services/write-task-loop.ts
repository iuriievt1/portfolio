import {
	FAILED_ATTEMPT_STEP,
	type FailedAttemptStep,
	JOB_KIND,
	QUEUE_FAILURE,
	type QueueClaimRule,
	type QueueFailure,
	type QueueLoopTiming,
	QueueTaskLoop,
} from "@ansora/core-server"
import { CLINICAL_RECORD_FAILURE, ClinicalRecordStoreError, type ClinicalRecordStorePort } from "@ansora/vulna-domain"
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common"
import { WRITE_TASK_LEASE_MILLISECONDS, WRITE_TASK_POLL_MILLISECONDS } from "../constants/clinical-record.constants"
import type { WriteTaskRepository } from "../repositories/write-task.repository"
import type { ClaimedWriteTask, WriteTaskObjectKind } from "../types/clinical-record.types"
import type { ClinicalRecordStoreService } from "./clinical-record-store.service"

const WRITE_TASK_TIMING: QueueLoopTiming = {
	leaseMilliseconds: WRITE_TASK_LEASE_MILLISECONDS,
	pollMilliseconds: WRITE_TASK_POLL_MILLISECONDS,
}

// ADR-050 bod 10, CAP-021-R27
function writeFailureOf(error: unknown): QueueFailure {
	if (!(error instanceof ClinicalRecordStoreError)) {
		return QUEUE_FAILURE.TRANSIENT
	}
	switch (error.failure) {
		case CLINICAL_RECORD_FAILURE.REJECTED:
			return QUEUE_FAILURE.PERMANENT
		case CLINICAL_RECORD_FAILURE.UNKNOWN:
			return QUEUE_FAILURE.UNKNOWN_OUTCOME
		case CLINICAL_RECORD_FAILURE.UNAVAILABLE:
			return QUEUE_FAILURE.TRANSIENT
		default:
			return error.failure satisfies never
	}
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

// CAP-021-R31, ADR-016 ř. 54, ADR-050 bod 10
export abstract class WriteTaskLoop
	extends QueueTaskLoop<WriteTaskObjectKind, ClinicalRecordStorePort>
	implements OnApplicationBootstrap, OnApplicationShutdown
{
	private warnedAboutStore = false

	protected constructor(
		protected readonly tasks: WriteTaskRepository,
		private readonly stores: ClinicalRecordStoreService,
	) {
		super(tasks.queue, WRITE_TASK_TIMING)
	}

	onApplicationBootstrap(): void {
		this.startPolling()
	}

	onApplicationShutdown(): void {
		this.stopPolling()
	}

	async writeNext(): Promise<boolean> {
		return await this.runNext()
	}

	protected claimRule(): QueueClaimRule<WriteTaskObjectKind> {
		return {
			kind: JOB_KIND.CLINICAL_RECORD_WRITE,
			objectKinds: [this.tasks.objectKind],
			condition: undefined,
			countsAttempts: true,
		}
	}

	protected async prepare(): Promise<ClinicalRecordStorePort | undefined> {
		const store = await this.stores.current()
		if (store === undefined) {
			this.warnOnceAboutStore()
		}
		return store
	}

	// ADR-050 bod 10, CAP-001-S34, CAP-021-R27
	protected async settleFailure(task: ClaimedWriteTask, subject: string, error: unknown): Promise<void> {
		const step = await this.settleFailedAttempt(task, writeFailureOf(error), async () => await this.tasks.fail(task))
		this.logSettled(task, subject, error, step)
	}

	private logSettled(task: ClaimedWriteTask, subject: string, error: unknown, step: FailedAttemptStep): void {
		switch (step.kind) {
			case FAILED_ATTEMPT_STEP.FAIL:
				this.logger.error(`The store rejected ${subject} (task ${task.id}): ${messageOf(error)}`)
				return
			case FAILED_ATTEMPT_STEP.FAIL_AFTER_UNKNOWN_OUTCOMES:
				this.logger.error(
					`The outcome of writing ${subject} (task ${task.id}) stayed unknown ${step.unknownOutcomes} times: ${messageOf(error)}`,
				)
				return
			case FAILED_ATTEMPT_STEP.RETRY_AFTER_UNKNOWN_OUTCOME:
				this.logger.warn(
					`The outcome of writing ${subject} (task ${task.id}) is unknown (${step.unknownOutcomes}), waits ${step.delayMilliseconds} ms: ${messageOf(error)}`,
				)
				return
			case FAILED_ATTEMPT_STEP.RETRY_LATER:
				this.logger.warn(`Writing ${subject} (task ${task.id}) waits ${step.delayMilliseconds} ms: ${String(error)}`)
				return
			default:
				step satisfies never
		}
	}

	private warnOnceAboutStore(): void {
		if (this.warnedAboutStore) {
			return
		}
		this.warnedAboutStore = true
		this.logger.warn("Write tasks wait: the clinical record store address or credential is not configured")
	}
}
