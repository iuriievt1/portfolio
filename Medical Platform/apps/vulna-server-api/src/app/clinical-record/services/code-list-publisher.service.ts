import { codeListSetVersionText } from "@ansora/core-server"
import type { ClinicalCodeListSet, ClinicalRecordStorePort } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { CodeListRepository } from "../../code-list/repositories/code-list.repository"
import { CodeListSetRepository } from "../../code-list/repositories/code-list-set.repository"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { READ_ONLY_SNAPSHOT } from "../constants/clinical-record.constants"
import { CodeListSetTaskRepository } from "../repositories/code-list-set-task.repository"
import type { ClaimedWriteTask, CodeListPublication } from "../types/clinical-record.types"
import { ClinicalRecordStoreService } from "./clinical-record-store.service"
import { WriteTaskLoop } from "./write-task-loop"

// CAP-017-R20, CAP-017-S15, ADR-050 bod 7, backend.md 3
@Injectable()
export class CodeListPublisherService extends WriteTaskLoop {
	protected readonly logger = new Logger(CodeListPublisherService.name)

	constructor(
		private readonly database: DatabaseService,
		tasks: CodeListSetTaskRepository,
		private readonly codeLists: CodeListRepository,
		private readonly sets: CodeListSetRepository,
		private readonly configuration: ConfigurationService,
		stores: ClinicalRecordStoreService,
	) {
		super(tasks, stores)
	}

	// CAP-017-R20, CAP-017-S15
	protected async handle(task: ClaimedWriteTask, store: ClinicalRecordStorePort): Promise<void> {
		const publication = await this.latestPublication()
		if (publication === undefined) {
			await this.tasks.fail(task)
			this.logger.error(`Task ${task.id} found no code list set to publish`)
			return
		}
		const subject = `code list set ${publication.content.version}`
		try {
			await store.publishCodeLists(publication.content)
			await this.tasks.complete(task)
		} catch (error) {
			await this.settleFailure(task, subject, error)
			return
		}
		this.logger.log(`The ${subject} is published to the clinical record (task ${task.id})`)
		await this.republishIfSuperseded(publication.version)
	}

	private async latestPublication(): Promise<CodeListPublication | undefined> {
		const defaultLanguage = await this.configuration.instanceDefaultLanguage()
		return await this.database.sql.begin(READ_ONLY_SNAPSHOT, async (tx) => {
			const latest = await this.sets.latest(tx)
			if (latest === undefined) {
				return undefined
			}
			return { version: latest.version, content: await this.contentOf(tx, latest.version, defaultLanguage) }
		})
	}

	private async contentOf(
		tx: postgres.TransactionSql,
		version: number,
		defaultLanguage: string,
	): Promise<ClinicalCodeListSet> {
		const lists = await this.codeLists.lists(tx)
		const items = await this.codeLists.items(tx, undefined)
		return {
			version: codeListSetVersionText(version),
			defaultLanguage,
			codeLists: lists.map((list) => ({
				code: list.code,
				title: list.name,
				concepts: items
					.filter((item) => item.codeListCode === list.code)
					.map((item) => ({ code: item.code, isActive: item.isActive, names: item.names })),
			})),
		}
	}

	// ADR-050 bod 7
	private async republishIfSuperseded(publishedVersion: number): Promise<void> {
		const latest = await this.sets.latest(this.database.sql)
		if (latest === undefined || latest.version <= publishedVersion) {
			return
		}
		await this.database.sql.begin(async (tx) => {
			await this.tasks.enqueue(tx, latest.id)
		})
		this.logger.log(`Code list set ${latest.version} is queued again after set ${publishedVersion}`)
	}
}
