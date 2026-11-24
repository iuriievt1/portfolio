import type { ClinicalRecordStorePort } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { FHIR_RESOURCE_TYPE, LOCAL_KIND } from "../constants/clinical-record.constants"
import { ActorTaskRepository } from "../repositories/actor-task.repository"
import { ClinicalActorRepository } from "../repositories/clinical-actor.repository"
import { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import type { ClaimedWriteTask } from "../types/clinical-record.types"
import { ClinicalRecordStoreService } from "./clinical-record-store.service"
import { WriteTaskLoop } from "./write-task-loop"

// CAP-001-R31, CAP-021-R38, CAP-021-S33, CAP-001-S34, ADR-054 bod 3, datovy-model.md 13.2
@Injectable()
export class ActorWriterService extends WriteTaskLoop {
	protected readonly logger = new Logger(ActorWriterService.name)

	constructor(
		tasks: ActorTaskRepository,
		private readonly actors: ClinicalActorRepository,
		private readonly database: DatabaseService,
		private readonly links: FhirResourceLinkRepository,
		stores: ClinicalRecordStoreService,
	) {
		super(tasks, stores)
	}

	protected async handle(task: ClaimedWriteTask, store: ClinicalRecordStorePort): Promise<void> {
		const userId = task.objectId
		const actor = await this.actors.actorOf(userId)
		if (actor === undefined) {
			await this.tasks.fail(task)
			this.logger.error(`Task ${task.id} names user ${userId}, who does not exist`)
			return
		}
		try {
			const membership = await store.recordActor(actor)
			await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
				await this.links.upsert(tx, [
					{
						resourceType: FHIR_RESOURCE_TYPE.PROJECT_MEMBERSHIP,
						localKind: LOCAL_KIND.ACTOR,
						localId: userId,
						resourceId: membership,
					},
				])
			})
			await this.tasks.complete(task)
		} catch (error) {
			await this.settleFailure(task, `the actor of user ${userId}`, error)
		}
	}
}
