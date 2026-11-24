import { ERROR_CODE, RELEASE_KIND } from "@ansora/contracts"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { AcquisitionDraftRepository } from "../../acquisition/repositories/acquisition-draft.repository"
import { clinicalReadsFake, type StoreHistory } from "../../clinical-record/__tests__/clinical-read-fixtures"
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
import type { DetailRecordRepository } from "../repositories/detail-record.repository"
import { AcquisitionDetailService } from "../services/acquisition-detail.service"
import type { DetailRecordRow } from "../types/acquisition-detail.types"
import { DETAIL_RECORD, photoRecord, scanRecord, storeScanOf, storeWoundOf } from "./acquisition-detail-fixtures"

const IMAGE = "c0000000-0000-4000-8000-000000000041"
const PAGE = "c0000000-0000-4000-8000-000000000042"

const PAGE_COUNT = 1

function shownByStore(record: DetailRecordRow | undefined): Partial<StoreHistory> {
	if (record === undefined) {
		return {}
	}
	return record.kind === "photo" ? { wounds: [storeWoundOf(record)] } : { scans: [storeScanOf(record, PAGE_COUNT)] }
}

function harness(record: DetailRecordRow | undefined, history: Partial<StoreHistory> = shownByStore(record)) {
	const releases: RecordRelease[] = []
	const records = { findById: async () => record } as unknown as DetailRecordRepository
	const files = {
		imagesOf: async () => [recordFile({ id: IMAGE, acquisition_id: DETAIL_RECORD })],
		pagesOf: async () => [recordFile({ id: PAGE, acquisition_id: DETAIL_RECORD })],
	} as unknown as RecordFileRepository
	const encounters = { findById: async () => encounterRow() } as unknown as EncounterRepository
	const drafts = {
		visibleCounts: async (_sql: never, ids: readonly string[]) => ids.map((id) => ({ encounter_id: id, count: 3 })),
	} as unknown as AcquisitionDraftRepository
	const { reads } = clinicalReadsFake(history)
	const patients = {
		byIds: async (ids: readonly string[]) => ids.filter((id) => id === PATIENT).map((id) => foundPatient(id)),
	} as unknown as PatientRepository
	const recorder = {
		record: async (_current: never, release: RecordRelease) => {
			releases.push(release)
		},
	} as unknown as RecordReleaseService
	const database = fakeDatabase()
	const service = new AcquisitionDetailService(
		database,
		records,
		files,
		encounters,
		new EncounterViewService(database, drafts, reads),
		reads,
		new PatientLookupService(patients),
		recorder,
	)
	return { service, releases }
}

describe("detail of a closed record CAP-020-R17", () => {
	it("CAP-020-S25 CAP-025-R28 shows a wound with the type it closed with and audits the opening", async () => {
		const run = harness(photoRecord())

		const detail = await run.service.detail(CURRENT, DETAIL_RECORD, NOW)

		expect(detail.wound_type_code).toBe("leg-ulcer")
		expect(detail.encounter.acquisition_count).toBe(3)
		expect(detail.files.map((file) => file.image_id)).toEqual([IMAGE])
		expect(run.releases).toEqual([
			{
				kind: RELEASE_KIND.ACQUISITION_DETAIL,
				objectId: DETAIL_RECORD,
				patient: foundPatient(PATIENT),
				encounterId: ENCOUNTER,
				acquisitionId: DETAIL_RECORD,
				releasedItemCount: 1,
			},
		])
	})

	it("CAP-020-S25 shows a record closed before the type changed with the type it closed with", async () => {
		const run = harness(
			photoRecord({ closed_wound_type_code: "traumatic-wound", closed_wound_type_code_list_version: 3 }),
		)

		const detail = await run.service.detail(CURRENT, DETAIL_RECORD, NOW)

		expect(detail.wound_type_code).toBe("traumatic-wound")
		expect(detail.wound_type_code_list_version).toBe("3")
	})

	it("CAP-020-S12 shows a document with its pages and no wound type", async () => {
		const run = harness(scanRecord())

		const detail = await run.service.detail(CURRENT, DETAIL_RECORD, NOW)

		expect(detail.files.map((file) => file.page_id)).toEqual([PAGE])
		expect(detail.wound_type_code).toBeNull()
	})

	it("CAP-015-R17 answers a draft as not found and audits nothing released", async () => {
		const run = harness(photoRecord({ state: ACQUISITION_STATE.DRAFT, closed_at: null }))

		const problem = await problemOf(run.service.detail(CURRENT, DETAIL_RECORD, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
		expect(problem.code).toBe(ERROR_CODE.RESOURCE_NOT_FOUND)
		expect(run.releases).toEqual([expect.objectContaining({ releasedItemCount: 0 })])
	})

	it("CAP-020-S14 answers a record the store does not show exactly like an unknown one", async () => {
		const outside = harness(photoRecord(), {})
		const unknown = harness(undefined)

		const outsideProblem = await problemOf(outside.service.detail(CURRENT, DETAIL_RECORD, NOW))
		const unknownProblem = await problemOf(unknown.service.detail(CURRENT, DETAIL_RECORD, NOW))

		expect(outsideProblem.getStatus()).toBe(unknownProblem.getStatus())
		expect(outsideProblem.code).toBe(unknownProblem.code)
		expect(outside.releases).toEqual([
			expect.objectContaining({ patient: foundPatient(PATIENT), releasedItemCount: 0 }),
		])
		expect(unknown.releases).toEqual([expect.objectContaining({ patient: undefined, releasedItemCount: 0 })])
	})

	it("ADR-054 bod 5 CAP-025-R28 answers that the documentation is unavailable and audits a release of nothing", async () => {
		const run = harness(photoRecord(), { unavailable: true })

		const problem = await problemOf(run.service.detail(CURRENT, DETAIL_RECORD, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		expect(run.releases).toEqual([expect.objectContaining({ patient: foundPatient(PATIENT), releasedItemCount: 0 })])
	})
})
