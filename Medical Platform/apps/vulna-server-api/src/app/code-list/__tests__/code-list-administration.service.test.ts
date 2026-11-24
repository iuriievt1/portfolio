import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, type CodeListItemState, PERMISSIONS } from "@ansora/core-server"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { CodeListSetTaskRepository } from "../../clinical-record/repositories/code-list-set-task.repository"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { problemOf } from "../../encounter/__tests__/encounter-fixtures"
import type { LocalizationService } from "../../localization/localization.service"
import { translationImportSchema } from "../dto/code-list-administration.input.dto"
import type { CodeListRepository } from "../repositories/code-list.repository"
import type { CodeListSetRepository } from "../repositories/code-list-set.repository"
import { CodeListAdministrationService } from "../services/code-list-administration.service"
import type { ItemNameWrite, StoredCodeListItem } from "../types/code-list.types"

const ADMINISTRATOR: AdministrationSession = {
	sessionId: "9e8d7c6b-5a49-4382-8170-6f5e4d3c2b1a",
	userId: "3f0d1c2e-5b6a-4c7d-8e9f-0a1b2c3d4e5f",
	permissions: PERMISSIONS,
}
const SET_ID = "5e000000-0000-4000-8000-000000000005"
const WOUND_TYPES = "wound-type"

function item(code: string, names: Record<string, string>, isActive = true): StoredCodeListItem {
	return { id: `id-${code}`, codeListCode: WOUND_TYPES, code, sequence: 1, isActive, names }
}

function harness(initial: StoredCodeListItem[] = [item("leg-ulcer", { cs: "Bércový vřed", en: "Leg ulcer" })]) {
	let items = initial
	const written: CodeListItemState[][] = []
	const names: ItemNameWrite[][] = []
	const enqueued: string[] = []
	const audits: NewAuditEvent[] = []
	const versions: string[] = []
	const steps: string[] = []
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => await work({} as never) },
	} as unknown as DatabaseService
	const codeLists = {
		hasList: async (_sql: never, code: string) => code === WOUND_TYPES,
		items: async () => items,
		writeItems: async (_tx: never, _code: string, changed: CodeListItemState[]) => {
			written.push(changed)
			items = items.map((stored) => {
				const next = changed.find((candidate) => candidate.code === stored.code)
				return next === undefined ? stored : { ...stored, ...next }
			})
		},
		writeNames: async (_tx: never, writes: ItemNameWrite[]) => {
			names.push(writes)
		},
	} as unknown as CodeListRepository
	const sets = {
		lock: async () => {
			steps.push("lock")
		},
		current: async () => ({ id: "s4", version: 4, body_diagram_version: "1" }),
		publish: async () => ({ id: SET_ID, version: 5, body_diagram_version: "1" }),
	} as unknown as CodeListSetRepository
	const tasks = {
		enqueue: async (_tx: never, id: string) => {
			enqueued.push(id)
		},
	} as unknown as CodeListSetTaskRepository
	const localization = { defaultLanguage: async () => "cs" } as unknown as LocalizationService
	const configuration = {
		recordVersion: async (_tx: never, _user: string, reason: string) => {
			versions.push(reason)
			return 7
		},
		current: async () => ({ version: 6 }),
		instanceDefaultLanguage: async () => {
			steps.push("default language")
			return "cs"
		},
	} as unknown as ConfigurationService
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audits.push(event)
		},
	} as unknown as AuditRepository
	const service = new CodeListAdministrationService(
		database,
		codeLists,
		sets,
		tasks,
		localization,
		configuration,
		audit,
	)
	return { service, written, names, enqueued, audits, versions, steps }
}

describe("code list items edited in the administration CAP-017-R05", () => {
	it("CAP-017-S08 refuses a new item named only in English and changes nothing", async () => {
		const run = harness()

		const problem = await problemOf(
			run.service.setItems(
				WOUND_TYPES,
				[
					{ code: "leg-ulcer", name: "Bércový vřed" },
					{ code: "burn", name: "", names: { en: "Burn" } },
				],
				ADMINISTRATOR,
			),
		)

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.CODE_LIST_ITEM_NAME_MISSING)
		expect(run.written).toEqual([])
		expect(run.enqueued).toEqual([])
	})

	it("CAP-017-S02 CAP-017-R20 renames an item, publishes a new set to the clinical record and audits it", async () => {
		const run = harness()

		const items = await run.service.setItems(
			WOUND_TYPES,
			[{ code: "leg-ulcer", name: "Bércový vřed (ulcus cruris)" }],
			ADMINISTRATOR,
		)

		expect(items).toEqual([
			{
				code: "leg-ulcer",
				name: "Bércový vřed (ulcus cruris)",
				names: { cs: "Bércový vřed (ulcus cruris)", en: "Leg ulcer" },
				sequence: 1,
				is_active: true,
			},
		])
		expect(run.enqueued).toEqual([SET_ID])
		expect(run.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.CONFIGURATION_CHANGED,
				objectId: SET_ID,
				details: { code_list_code: WOUND_TYPES, code_list_set_version: "5", changed_items: 1, changed_names: 1 },
			}),
		])
		expect(JSON.stringify(run.audits[0]?.details)).not.toContain("ulcus")
	})

	it("CAP-012-R28 reads the default language only after it holds the code list lock", async () => {
		const run = harness()

		await run.service.setItems(WOUND_TYPES, [{ code: "leg-ulcer", name: "Bércový vřed" }], ADMINISTRATOR)

		expect(run.steps).toEqual(["lock", "default language"])
	})

	it("publishes nothing when the list does not change", async () => {
		const run = harness()

		await run.service.setItems(WOUND_TYPES, [{ code: "leg-ulcer", name: "Bércový vřed" }], ADMINISTRATOR)

		expect(run.enqueued).toEqual([])
		expect(run.audits).toEqual([])
	})

	it("answers 404 for a code list the instance does not have", async () => {
		const problem = await problemOf(harness().service.items("unknown"))

		expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.NOT_FOUND)
	})
})

describe("translations imported by stable code CAP-017-R18", () => {
	it("CAP-017-S09 adds German names, keeps the codes and records a configuration version", async () => {
		const run = harness()

		const result = await run.service.importTranslations(
			{
				language: "de",
				reason: "Německé názvy",
				items: [{ code_list_code: WOUND_TYPES, code: "leg-ulcer", name: "Ulcus cruris" }],
			},
			ADMINISTRATOR,
		)

		expect(result).toEqual({
			language: "de",
			updated_count: 1,
			unchanged_count: 0,
			configuration_version: 7,
			code_list_set_version: "5",
		})
		expect(run.names).toEqual([[{ itemId: "id-leg-ulcer", language: "de", name: "Ulcus cruris" }]])
		expect(run.written).toEqual([])
		expect(run.versions).toEqual(["Německé názvy"])
		expect(run.audits[0]?.details).toMatchObject({ version: 7, language: "de", changed_names: 1 })
	})

	it("writes a language under the form the item already stores, regardless of case", async () => {
		const run = harness()

		await run.service.importTranslations(
			{
				language: "EN",
				reason: "Anglické názvy",
				items: [{ code_list_code: WOUND_TYPES, code: "leg-ulcer", name: "Venous leg ulcer" }],
			},
			ADMINISTRATOR,
		)

		expect(run.names).toEqual([[{ itemId: "id-leg-ulcer", language: "en", name: "Venous leg ulcer" }]])
	})

	it("refuses an empty name as name-missing, not as an invalid request", async () => {
		const input = {
			language: "de",
			reason: "Německé názvy",
			items: [{ code_list_code: WOUND_TYPES, code: "leg-ulcer", name: "" }],
		}
		expect(translationImportSchema.safeParse(input).success).toBe(true)

		const problem = await problemOf(harness().service.importTranslations(input, ADMINISTRATOR))

		expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.CODE_LIST_ITEM_UNKNOWN)
		expect(problem.extensions.rejected_rows).toEqual([{ row: 1, code: "name-missing" }])
	})

	it("refuses the whole import with the rows it does not know", async () => {
		const run = harness()

		const problem = await problemOf(
			run.service.importTranslations(
				{
					language: "de",
					reason: "Německé názvy",
					items: [
						{ code_list_code: WOUND_TYPES, code: "leg-ulcer", name: "Ulcus cruris" },
						{ code_list_code: WOUND_TYPES, code: "missing", name: "Fehlt" },
					],
				},
				ADMINISTRATOR,
			),
		)

		expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.CODE_LIST_ITEM_UNKNOWN)
		expect(problem.extensions.rejected_rows).toEqual([{ row: 2, code: "code-list-item-unknown" }])
		expect(run.names).toEqual([])
	})
})
