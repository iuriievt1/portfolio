import type { ClinicalRecordStorePort } from "@ansora/vulna-domain"
import type { ClaimedWriteTask } from "../types/clinical-record.types"
import { WriteTaskLoop } from "./write-task-loop"

// CAP-021-R37, CAP-021-R39, ADR-050 bod 10, datovy-model.md 4
export abstract class ResourceWriter<Content> extends WriteTaskLoop {
	protected abstract subjectOf(task: ClaimedWriteTask): string

	protected abstract contentOf(task: ClaimedWriteTask, store: ClinicalRecordStorePort): Promise<Content | undefined>

	protected abstract record(store: ClinicalRecordStorePort, content: Content): Promise<string>

	protected abstract remember(task: ClaimedWriteTask, resourceId: string, content: Content): Promise<void>

	protected async handle(task: ClaimedWriteTask, store: ClinicalRecordStorePort): Promise<void> {
		const subject = this.subjectOf(task)
		try {
			const content = await this.contentOf(task, store)
			if (content === undefined) {
				await this.tasks.fail(task)
				this.logger.error(`Task ${task.id} cannot build ${subject}`)
				return
			}
			const resourceId = await this.record(store, content)
			await this.remember(task, resourceId, content)
			await this.tasks.complete(task)
		} catch (error) {
			await this.settleFailure(task, subject, error)
			return
		}
		this.logger.log(`Recorded ${subject} in the clinical record (task ${task.id})`)
	}
}
