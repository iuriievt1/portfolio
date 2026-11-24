import { ERROR_CODE, RELEASE_KIND } from "@ansora/contracts"
import type { HistoryScanRecord } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { AcquisitionDraftRepository } from "../../acquisition/repositories/acquisition-draft.repository"
import { clinicalReadsFake, type StoreHistory } from "../../clinical-record/__tests__/clinical-read-fixtures"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import {
	CURRENT,
	ENCOUNTER,
	encounterRow,
	fakeDatabase,
	foundPatient,
	NOW,
	PATIENT,
	problemOf,
} from "../../encounter/__tests__/encounter-fixtures"
import type { EncounterRepository } from "../../encounter/repositories/encounter.repository"
import { EncounterViewService } from "../../encounter/services/encounter-view.service"
import { recordFile } from "../../image/__tests__/image-fixtures"
import type { RecordFileRepository } from "../../image/repositories/record-file.repository"
import type { RecordReleaseService } from "../../image/services/record-release.service"
import type { RecordRelease } from "../../image/types/image.types"
import type { PatientRepository } from "../../registry/repositories/patient.repository"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { PatientDocumentRepository } from "../repositories/patient-document.repository"
import { PatientDocumentsService } from "../services/patient-documents.service"
import type { PatientDocumentItemView, PatientDocumentRow } from "../types/document.types"

const NEWER = "a0000000-0000-4000-8000-000000000031"
const OLDER = "a0000000-0000-4000-8000-000000000032"
const PAGE_SIZE = { defaultSize: 20, maxSize: 50 }
const STORED_PAGE_COUNT = 2

function documentRow(id: string, closedAt: string): PatientDocumentRow {
	return {
		id,
		encounter_id: ENCOUNTER,
		closed_at: new Date(closedAt),
		file_count: 1,
		cursor_moment: closedAt,
		title_code: null,
		title_text: "Lékařská zpráva",
		title_code_list_version: null,
	}
}

function storedScan(row: PatientDocumentRow): HistoryScanRecord {
	return {
		acquisitionId: row.id,
		documentId: `document of ${row.id}`,
		closedAt: row.closed_at.toISOString(),
		title: { code: undefined, text: "Propouštěcí zpráva" },
		pageCount: STORED_PAGE_COUNT,
	}
}

interface ListCall {
	patientId: string
	visibleAcquisitionIds: readonly string[]
}

function harness(
	rows: readonly PatientDocumentRow[],
	history: Partial<StoreHistory> = { scans: rows.map(storedScan) },
) {
	const releases: RecordRelease[] = []
	const calls: ListCall[] = []
	const documents = {
		listClosed: async (patientId: string, visibleAcquisitionIds: readonly string[]) => {
			calls.push({ patientId, visibleAcquisitionIds })
			return { rows: rows.filter((row) => visibleAcquisitionIds.includes(row.id)), nextCursor: null }
		},
	} as unknown as PatientDocumentRepository
	const files = {
		pagesOf: async (_sql: never, ids: readonly string[]) =>
			ids.flatMap((id) => [recordFile({ id: `${id.slice(0, -1)}9`, acquisition_id: id })]),
	} as unknown as RecordFileRepository
	const encounters = {
		findByIds: async (_sql: never, ids: readonly string[]) => ids.map((id) => encounterRow({ id })),
	} as unknown as EncounterRepository
	const drafts = {
		visibleCounts: async (_sql: never, ids: readonly string[]) => ids.map((id) => ({ encounter_id: id, count: 2 })),
	} as unknown as AcquisitionDraftRepository
	const patients = {
		byIds: async (ids: readonly string[]) => ids.filter((id) => id === PATIENT).map((id) => foundPatient(id)),
	} as unknown as PatientRepository
	const recorder = {
		record: async (_current: never, release: RecordRelease) => {
			releases.push(release)
		},
	} as unknown as RecordReleaseService
	const configuration = { pageSize: async () => PAGE_SIZE } as unknown as ConfigurationService
	const { reads } = clinicalReadsFake(history)
	const database = fakeDatabase()
	const service = new PatientDocumentsService(
		database,
		documents,
		files,
		encounters,
		new EncounterViewService(database, drafts, reads),
		reads,
		new PatientLookupService(patients),
		recorder,
		configuration,
	)
	return { service, releases, calls }
}

describe("documents of a patient CAP-020-R18", () => {
	it("CAP-020-S15 lists the closed documents the store shows newest first with their visit and pages", async () => {
		const run = harness([documentRow(NEWER, "2026-09-12T07:00:00Z"), documentRow(OLDER, "2026-09-04T12:40:00Z")])

		const page = await run.service.list(CURRENT, { patient_id: PATIENT }, NOW)

		expect(run.calls).toEqual([{ patientId: PATIENT, visibleAcquisitionIds: [NEWER, OLDER] }])
		const items = page.items as PatientDocumentItemView[]
		expect(items.map((item) => [item.acquisition_id, item.page_count, item.encounter.acquisition_count])).toEqual([
			[NEWER, STORED_PAGE_COUNT, 2],
			[OLDER, STORED_PAGE_COUNT, 2],
		])
		expect(items[0]?.document_title).toEqual({ text: "Propouštěcí zpráva" })
		expect(page.next_cursor).toBeNull()
	})

	it("CAP-025-R28 audits the release of the list with the patient and the count, even zero", async () => {
		const run = harness([])

		await run.service.list(CURRENT, { patient_id: PATIENT }, NOW)

		expect(run.releases).toEqual([
			{
				kind: RELEASE_KIND.PATIENT_DOCUMENTS,
				objectId: PATIENT,
				patient: foundPatient(PATIENT),
				encounterId: undefined,
				acquisitionId: undefined,
				releasedItemCount: 0,
			},
		])
	})

	it("CAP-020-S16 lists no document the store does not show", async () => {
		const run = harness([documentRow(NEWER, "2026-09-12T07:00:00Z")], {})

		const page = await run.service.list(CURRENT, { patient_id: PATIENT }, NOW)

		expect(run.calls).toEqual([{ patientId: PATIENT, visibleAcquisitionIds: [] }])
		expect(page.items).toEqual([])
	})

	it("ADR-054 bod 5 CAP-025-R28 answers that the documentation is unavailable and audits a release of nothing", async () => {
		const run = harness([documentRow(NEWER, "2026-09-12T07:00:00Z")], { unavailable: true })

		const problem = await problemOf(run.service.list(CURRENT, { patient_id: PATIENT }, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		expect(run.releases).toEqual([
			expect.objectContaining({ objectId: PATIENT, patient: foundPatient(PATIENT), releasedItemCount: 0 }),
		])
	})
})
