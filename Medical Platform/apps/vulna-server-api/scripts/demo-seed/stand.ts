import { CODE_LIST } from "@ansora/contracts"
import { AuditRepository } from "../../src/app/audit/repositories/audit.repository"
import type { ActorTaskRepository } from "../../src/app/clinical-record/repositories/actor-task.repository"
import { CodeListSetTaskRepository } from "../../src/app/clinical-record/repositories/code-list-set-task.repository"
import { CodeListRepository } from "../../src/app/code-list/repositories/code-list.repository"
import { CodeListSetRepository } from "../../src/app/code-list/repositories/code-list-set.repository"
import { CodeListAdministrationService } from "../../src/app/code-list/services/code-list-administration.service"
import type { ConfigurationService } from "../../src/app/configuration/services/configuration.service"
import { LocalizationService } from "../../src/app/localization/localization.service"
import { AdministratorAlertRepository } from "../../src/app/monitoring/repositories/administrator-alert.repository"
import type { DatabaseService } from "../../src/libs/database/database.service"
import { ProfileService } from "../../src/libs/profile/profile.service"
import { ensureStandOperator, STAND_OPERATOR_USER_ID } from "./context"
import { demoId } from "./demo-id"
import type { DemoDataset, DemoTitle } from "./demo-types"

// Q-040, CAP-001-R31, ADR-053 bod 6
export async function prepareStand(
	database: DatabaseService,
	configuration: ConfigurationService,
	actorTasks: ActorTaskRepository,
	dataset: DemoDataset,
): Promise<void> {
	await database.sql.begin(async (tx) => {
		await ensureStandOperator(tx, dataset)
		await actorTasks.enqueue(tx, STAND_OPERATOR_USER_ID)
	})
	await offerTitles(database, configuration, dataset.titles)
}

// CAP-017-R08, CAP-025-R07
async function offerTitles(
	database: DatabaseService,
	configuration: ConfigurationService,
	titles: readonly DemoTitle[],
): Promise<void> {
	const codeLists = new CodeListAdministrationService(
		database,
		new CodeListRepository(),
		new CodeListSetRepository(),
		new CodeListSetTaskRepository(database, new AdministratorAlertRepository(database), new AuditRepository()),
		new LocalizationService(configuration, new ProfileService()),
		configuration,
		new AuditRepository(),
	)
	const defaultLanguage = await configuration.instanceDefaultLanguage()
	const wanted = new Set(titles.map((title) => title.code))
	const existing = await codeLists.items(CODE_LIST.DOCUMENT_TITLE)
	const missing = titles.filter((title) => !existing.some((item) => item.code === title.code))
	const isOffered = existing.every((item) => !wanted.has(item.code) || item.is_active)
	if (missing.length === 0 && isOffered) {
		return
	}
	await codeLists.setItems(
		CODE_LIST.DOCUMENT_TITLE,
		[
			...existing.map((item) => (wanted.has(item.code) ? { ...item, is_active: true } : item)),
			...missing.map((title) => ({
				code: title.code,
				name: title.names[defaultLanguage] ?? title.code,
				names: title.names,
			})),
		],
		{ sessionId: demoId("session/stand-operator"), userId: STAND_OPERATOR_USER_ID, permissions: [] },
	)
}
