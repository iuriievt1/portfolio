import {
	JOB_KIND,
	JOB_OBJECT_KIND,
	type QueueClaimRule,
	type QueueLoopTiming,
	QueueTaskLoop,
	type QueueTaskStore,
	retryDelayMilliseconds,
} from "@ansora/core-server"
import { ClinicalRecordStoreError } from "@ansora/vulna-domain"
import { Logger } from "@nestjs/common"
import { TextRecognitionError } from "../../text-recognition/errors/text-recognition.error"
import { ASSEMBLY_TASK_LEASE_MILLISECONDS, ASSEMBLY_TASK_POLL_MILLISECONDS } from "../constants/assembly.constants"
import type { AssemblyObjectKind, AssemblySettings, ClaimedAssemblyTask } from "../types/assembly.types"
import type { AssemblerService } from "./assembler.service"
import type { AssemblySettingsService } from "./assembly-settings.service"

const ASSEMBLY_TASK_TIMING: QueueLoopTiming = {
	leaseMilliseconds: ASSEMBLY_TASK_LEASE_MILLISECONDS,
	pollMilliseconds: ASSEMBLY_TASK_POLL_MILLISECONDS,
}

// ADR-054 bod 4, CAP-022-R10
function isExpectedWait(error: unknown): boolean {
	return error instanceof ClinicalRecordStoreError || error instanceof TextRecognitionError
}

// ADR-016 ř. 54, 56–59, ADR-005 ř. 38, dorucovaci-jadro.md 4
export class AssemblyLane extends QueueTaskLoop<AssemblyObjectKind, AssemblySettings> {
	protected readonly logger = new Logger(AssemblyLane.name)

	constructor(
		queue: QueueTaskStore,
		private readonly settings: AssemblySettingsService,
		private readonly assembler: AssemblerService,
	) {
		super(queue, ASSEMBLY_TASK_TIMING)
	}

	protected claimRule(): QueueClaimRule<AssemblyObjectKind> {
		return {
			kind: JOB_KIND.ASSEMBLY,
			objectKinds: [JOB_OBJECT_KIND.ACQUISITION],
			condition: undefined,
			countsAttempts: true,
		}
	}

	protected async prepare(): Promise<AssemblySettings | undefined> {
		return await this.settings.current()
	}

	protected async handle(task: ClaimedAssemblyTask, settings: AssemblySettings): Promise<void> {
		try {
			await this.assembler.assemble(task, settings)
		} catch (error) {
			await this.retried(task, error)
		}
	}

	// ADR-054 bod 4, CAP-022-R10, dorucovaci-jadro.md 4, 5
	private async retried(task: ClaimedAssemblyTask, error: unknown): Promise<void> {
		const delayMilliseconds = retryDelayMilliseconds(task.attempts)
		await this.queue.retryLater(task.id, delayMilliseconds)
		const subject = `Assembling record ${task.objectId} (task ${task.id}) waits ${delayMilliseconds} ms`
		if (isExpectedWait(error)) {
			this.logger.warn(`${subject}: ${String(error)}`)
			return
		}
		this.logger.error(subject, error)
	}
}
