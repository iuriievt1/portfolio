import { ADMINISTRATION_ERROR_CODE, isSameLanguage } from "@ansora/contracts"
import {
	AUDIT_ACTOR_KIND,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	changeCodeListItems,
	codeListSetVersionText,
	importTranslations,
	type KnownNames,
	type RequestedCodeListItem,
	type TranslationRow,
} from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { CodeListSetTaskRepository } from "../../clinical-record/repositories/code-list-set-task.repository"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { LocalizationService } from "../../localization/localization.service"
import type { CodeListItemsInput, TranslationImportInput } from "../dto/code-list-administration.input.dto"
import { CodeListRepository } from "../repositories/code-list.repository"
import { CodeListSetRepository } from "../repositories/code-list-set.repository"
import type {
	AdministrationCodeList,
	AdministrationCodeListItem,
	CodeListSetRow,
	ItemNameWrite,
	StoredCodeListItem,
	TranslationImportResult,
} from "../types/code-list.types"
import { administrationItemView } from "../utils/code-list-item-view"

// CAP-017-R05, CAP-017-R13, CAP-017-R18, CAP-017-R20, CAP-012-R18, CAP-012-R19
@Injectable()
export class CodeListAdministrationService {
	constructor(
		private readonly database: DatabaseService,
		private readonly codeLists: CodeListRepository,
		private readonly sets: CodeListSetRepository,
		private readonly tasks: CodeListSetTaskRepository,
		private readonly localization: LocalizationService,
		private readonly configuration: ConfigurationService,
		private readonly audit: AuditRepository,
	) {}

	async lists(): Promise<AdministrationCodeList[]> {
		const rows = await this.codeLists.lists(this.database.sql)
		return rows.map((row) => ({ code: row.code, name: row.name, item_count: row.item_count }))
	}

	async items(codeListCode: string): Promise<AdministrationCodeListItem[]> {
		await this.requireList(this.database.sql, codeListCode)
		const items = await this.codeLists.items(this.database.sql, codeListCode)
		return viewsOf(items, await this.localization.defaultLanguage())
	}

	// CAP-017-R08, CAP-017-R18, CAP-017-S02, CAP-017-S08, CAP-012-R28
	async setItems(
		codeListCode: string,
		input: CodeListItemsInput,
		administrator: AdministrationSession,
	): Promise<AdministrationCodeListItem[]> {
		return await this.database.sql.begin(async (tx) => {
			await this.sets.lock(tx)
			await this.requireList(tx, codeListCode)
			const defaultLanguage = await this.configuration.instanceDefaultLanguage()
			const existing = await this.codeLists.items(tx, codeListCode)
			const change = changeCodeListItems(existing, input.map(requestedItemOf), defaultLanguage)
			if (!change.ok) {
				throw new ProblemException(
					HttpStatus.UNPROCESSABLE_ENTITY,
					ADMINISTRATION_ERROR_CODE.CODE_LIST_ITEM_NAME_MISSING,
					`items without a name in the default language ${defaultLanguage}: ${change.codesWithoutName.join(", ")}`,
				)
			}
			if (change.changed.length === 0) {
				return viewsOf(existing, defaultLanguage)
			}
			await this.codeLists.writeItems(tx, codeListCode, change.changed, existing)
			const set = await this.publish(tx, administrator)
			await this.audit.append(tx, {
				eventType: AUDIT_EVENT_TYPE.CONFIGURATION_CHANGED,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: administrator.userId,
				objectId: set.id,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: {
					code_list_code: codeListCode,
					code_list_set_version: codeListSetVersionText(set.version),
					changed_items: change.changed.length,
					changed_names: change.changedNames,
				},
			})
			return viewsOf(await this.codeLists.items(tx, codeListCode), defaultLanguage)
		})
	}

	// CAP-017-R18, CAP-017-S09, CAP-012-R19
	async importTranslations(
		input: TranslationImportInput,
		administrator: AdministrationSession,
	): Promise<TranslationImportResult> {
		return await this.database.sql.begin(async (tx) => {
			await this.sets.lock(tx)
			const items = await this.codeLists.items(tx, undefined)
			const outcome = importTranslations(
				knownNamesOf(items),
				input.language,
				input.items.map((row) => ({ codeListCode: row.code_list_code, code: row.code, name: row.name })),
			)
			if (!outcome.ok) {
				throw new ProblemException(
					HttpStatus.UNPROCESSABLE_ENTITY,
					ADMINISTRATION_ERROR_CODE.CODE_LIST_ITEM_UNKNOWN,
					`${outcome.rejectedRows.length} rows of the import were refused`,
					{},
					{ rejected_rows: outcome.rejectedRows },
				)
			}
			if (outcome.writes.length === 0) {
				return {
					language: input.language,
					updated_count: 0,
					unchanged_count: outcome.unchangedCount,
					configuration_version: (await this.configuration.current()).version,
					code_list_set_version: codeListSetVersionText((await this.sets.current(tx)).version),
				}
			}
			await this.codeLists.writeNames(tx, nameWritesOf(outcome.writes, items, input.language))
			const configurationVersion = await this.configuration.recordVersion(tx, administrator.userId, input.reason)
			const set = await this.publish(tx, administrator)
			await this.audit.append(tx, {
				eventType: AUDIT_EVENT_TYPE.CONFIGURATION_CHANGED,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: administrator.userId,
				objectId: set.id,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: {
					version: configurationVersion,
					reason: input.reason,
					language: input.language,
					changed_names: outcome.writes.length,
					code_list_set_version: codeListSetVersionText(set.version),
				},
			})
			return {
				language: input.language,
				updated_count: outcome.writes.length,
				unchanged_count: outcome.unchangedCount,
				configuration_version: configurationVersion,
				code_list_set_version: codeListSetVersionText(set.version),
			}
		})
	}

	// CAP-017-R20
	private async publish(tx: postgres.TransactionSql, administrator: AdministrationSession): Promise<CodeListSetRow> {
		const set = await this.sets.publish(tx, administrator.userId)
		await this.tasks.enqueue(tx, set.id)
		return set
	}

	private async requireList(sql: Executor, codeListCode: string): Promise<void> {
		if (!(await this.codeLists.hasList(sql, codeListCode))) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
		}
	}
}

function viewsOf(items: readonly StoredCodeListItem[], defaultLanguage: string): AdministrationCodeListItem[] {
	return items.map((item) => administrationItemView(item, defaultLanguage))
}

function requestedItemOf(item: CodeListItemsInput[number]): RequestedCodeListItem {
	return {
		code: item.code,
		name: item.name,
		names: item.names,
		sequence: item.sequence,
		isActive: item.is_active,
	}
}

function knownNamesOf(items: readonly StoredCodeListItem[]): KnownNames {
	const known = new Map<string, Map<string, Readonly<Record<string, string>>>>()
	for (const item of items) {
		const list = known.get(item.codeListCode) ?? new Map<string, Readonly<Record<string, string>>>()
		list.set(item.code, item.names)
		known.set(item.codeListCode, list)
	}
	return known
}

function itemKeyOf(codeListCode: string, code: string): string {
	return `${codeListCode}/${code}`
}

// CAP-017-R18
function nameWritesOf(
	writes: readonly TranslationRow[],
	items: readonly StoredCodeListItem[],
	language: string,
): ItemNameWrite[] {
	const itemByKey = new Map(items.map((item) => [itemKeyOf(item.codeListCode, item.code), item]))
	return writes.map((write) => {
		const item = itemByKey.get(itemKeyOf(write.codeListCode, write.code))
		if (item === undefined) {
			throw new Error(`the import names ${write.codeListCode}/${write.code}, which the transaction does not hold`)
		}
		const stored = Object.keys(item.names).find((key) => isSameLanguage(key, language))
		return { itemId: item.id, language: stored ?? language, name: write.name }
	})
}
