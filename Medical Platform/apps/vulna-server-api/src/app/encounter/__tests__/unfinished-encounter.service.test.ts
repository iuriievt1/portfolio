import { AUDIT_SEARCH_METHOD } from "@ansora/contracts"
import { AUDIT_OUTCOME } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { DocumentationUnavailableException } from "../../clinical-record/exceptions/documentation-unavailable.exception"
import type { ClinicalReadService } from "../../clinical-record/services/clinical-read.service"
import type { RecordVisibility } from "../../clinical-record/types/clinical-record.types"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import type { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { EncounterRepository } from "../repositories/encounter.repository"
import type { UnfinishedEncounterRepository } from "../repositories/unfinished-encounter.repository"
import type { EncounterViewService } from "../services/encounter-view.service"
import { UnfinishedEncounterService } from "../services/unfinished-encounter.service"
import type { EncounterRow, EncounterView, UnfinishedEncounterRow } from "../types/encounter.types"
import { CURRENT, ENCOUNTER, encounterRow, foundPatient, NOW, OTHER_PATIENT, PATIENT, USER } from "./encounter-fixtures"

const PAGE_SIZE = { defaultSize: 50, maxSize: 100 }
const OTHER_ENCOUNTER = "abababab-abab-4bab-8bab-abababababab"

const TODAY_VISIT: UnfinishedEncounterRow = {
	encounter_id: ENCOUNTER,
	last_documented_at: new Date("2026-10-07T07:30:00.000Z"),
	acquisition_ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
}
const EARLIER_VISIT: UnfinishedEncounterRow = {
	encounter_id: OTHER_ENCOUNTER,
	last_documented_at: new Date("2026-10-06T15:00:00.000Z"),
	acquisition_ids: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc", "dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
}

interface HarnessOptions {
	rows?: UnfinishedEncounterRow[]
	visibleIds?: string[]
	isStoreDown?: boolean
}

function viewOf(row: EncounterRow): EncounterView {
	return { encounter_id: row.id, patient_id: row.patient_id, status: row.status } as EncounterView
}

function harness(options: HarnessOptions = {}) {
	const rows = options.rows ?? [TODAY_VISIT, EARLIER_VISIT]
	const queries: { userId: string; limit: number }[] = []
	const visibilityQueries: string[][] = []
	const shownVisibility: RecordVisibility[] = []
	const audits: NewAuditEvent[] = []
	const encounterRows = [
		encounterRow({ id: ENCOUNTER, patient_id: PATIENT }),
		encounterRow({ id: OTHER_ENCOUNTER, patient_id: OTHER_PATIENT }),
	]
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => await work({} as never) },
	} as unknown as DatabaseService
	const unfinished = {
		ownUnfinished: async (userId: string, limit: number) => {
			queries.push({ userId, limit })
			return rows
		},
	} as unknown as UnfinishedEncounterRepository
	const encounters = {
		findByIds: async (_sql: never, ids: readonly string[]) => encounterRows.filter((row) => ids.includes(row.id)),
	} as unknown as EncounterRepository
	const views = {
		viewsWith: async (visibility: RecordVisibility, shown: readonly EncounterRow[]) => {
			shownVisibility.push(visibility)
			return shown.map(viewOf)
		},
	} as unknown as EncounterViewService
	const reads = {
		recordVisibilityOf: async (_current: never, encounterIds: string[]) => {
			visibilityQueries.push(encounterIds)
			if (options.isStoreDown === true) {
				throw new DocumentationUnavailableException()
			}
			return {
				userId: USER,
				closedAcquisitionIds: options.visibleIds ?? rows.flatMap((row) => row.acquisition_ids),
			}
		},
	} as unknown as ClinicalReadService
	const patients = {
		patientsById: async (ids: readonly string[]) => new Map(ids.map((id) => [id, foundPatient(id)])),
	} as unknown as PatientLookupService
	const configuration = { pageSize: async () => PAGE_SIZE } as unknown as ConfigurationService
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audits.push(event)
		},
	} as unknown as AuditRepository
	const service = new UnfinishedEncounterService(
		database,
		unfinished,
		encounters,
		views,
		reads,
		patients,
		configuration,
		audit,
	)
	return { service, queries, visibilityQueries, shownVisibility, audits }
}

describe("unfinished visits of the signed-in clinician CAP-014-R18", () => {
	it("asks for the own unfinished visits, at most the largest page", async () => {
		const run = harness()

		await run.service.list(CURRENT, NOW)

		expect(run.queries).toEqual([{ userId: USER, limit: PAGE_SIZE.maxSize }])
	})

	it("CAP-014-R20 lists each unfinished visit with its patient and the time of the last own record, newest first", async () => {
		const run = harness()

		const list = await run.service.list(CURRENT, NOW)

		expect(list.items.map((item) => item.encounter.encounter_id)).toEqual([ENCOUNTER, OTHER_ENCOUNTER])
		expect(list.items.map((item) => item.patient.patient_id)).toEqual([PATIENT, OTHER_PATIENT])
		expect(list.items[0]?.last_documented_at).toBe(TODAY_VISIT.last_documented_at.toISOString())
	})

	it("CAP-003-R01 CAP-020-R16 leaves out a visit where the store lets the clinician see none of the own records", async () => {
		const run = harness({ visibleIds: [EARLIER_VISIT.acquisition_ids[1] ?? ""] })

		const list = await run.service.list(CURRENT, NOW)

		expect(run.visibilityQueries).toEqual([[ENCOUNTER, OTHER_ENCOUNTER]])
		expect(list.items.map((item) => item.encounter.encounter_id)).toEqual([OTHER_ENCOUNTER])
		expect(run.shownVisibility[0]?.closedAcquisitionIds).toEqual([EARLIER_VISIT.acquisition_ids[1]])
	})

	it("CAP-025-R18 audits the released visits as a release of patient data", async () => {
		const run = harness()

		await run.service.list(CURRENT, NOW)

		expect(run.audits).toHaveLength(1)
		expect(run.audits[0]).toMatchObject({
			outcome: AUDIT_OUTCOME.MATCH,
			details: { search_method: AUDIT_SEARCH_METHOD.UNFINISHED_ENCOUNTERS, released_item_count: 2 },
		})
	})

	it("CAP-025-R18 audits an empty list without asking the clinical record store", async () => {
		const run = harness({ rows: [] })

		const list = await run.service.list(CURRENT, NOW)

		expect(list.items).toEqual([])
		expect(run.visibilityQueries).toEqual([])
		expect(run.audits[0]).toMatchObject({
			outcome: AUDIT_OUTCOME.NO_MATCH,
			details: { search_method: AUDIT_SEARCH_METHOD.UNFINISHED_ENCOUNTERS, released_item_count: 0 },
		})
	})

	it("CAP-020-R16 answers documentation-unavailable when the store is down and audits that nothing was released", async () => {
		const run = harness({ isStoreDown: true })

		await expect(run.service.list(CURRENT, NOW)).rejects.toBeInstanceOf(DocumentationUnavailableException)
		expect(run.audits).toHaveLength(1)
		expect(run.audits[0]?.details).toEqual({
			search_method: AUDIT_SEARCH_METHOD.UNFINISHED_ENCOUNTERS,
			released_item_count: 0,
		})
	})
})
