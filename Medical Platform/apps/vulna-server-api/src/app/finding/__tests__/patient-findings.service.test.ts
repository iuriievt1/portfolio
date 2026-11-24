import { ERROR_CODE } from "@ansora/contracts"
import type { HistoryWoundRecord } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import { clinicalReadsFake, type StoreHistory } from "../../clinical-record/__tests__/clinical-read-fixtures"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { CURRENT, foundPatient, PATIENT, problemOf } from "../../encounter/__tests__/encounter-fixtures"
import type { RecordReleaseService } from "../../image/services/record-release.service"
import type { RecordRelease } from "../../image/types/image.types"
import type { PatientRepository } from "../../registry/repositories/patient.repository"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { FindingRepository } from "../repositories/finding.repository"
import { PatientFindingsService } from "../services/patient-findings.service"
import type { TrackedFindingPage, TrackedFindingRow, VisibleFindings } from "../types/finding.types"
import { findingViewOf } from "../utils/finding-view"
import { storedFinding } from "./finding-fixtures"

const FINDING_ID = "d0000000-0000-4000-8000-000000000001"
const LAST_RECORD = "a0000000-0000-4000-8000-000000000021"
const NEXT_CURSOR = "next"
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

function trackedRow(overrides: Partial<TrackedFindingRow> = {}): TrackedFindingRow {
	return {
		id: FINDING_ID,
		patient_id: PATIENT,
		wound_number: 3,
		created_at: new Date("2026-09-01T08:00:00Z"),
		last_acquisition_id: LAST_RECORD,
		last_closed_at: new Date("2026-10-01T09:30:00Z"),
		cover_image_id: "c0000000-0000-4000-8000-0000000000aa",
		cursor_moment: "2026-09-01T08:00:00.000000Z",
		wound_type_code: "pressure-ulcer",
		wound_type_code_list_version: 3,
		last_healing_phase_code: "granulating",
		last_description: "Klidné okraje",
		last_assessment_code_list_version: 3,
		region_code: "51027004",
		laterality: null,
		view: "posterior",
		x: 0.5,
		y: 0.4625,
		body_diagram_version: "1",
		...overrides,
	}
}

const LAST_WOUND: HistoryWoundRecord = {
	acquisitionId: LAST_RECORD,
	findingId: FINDING_ID,
	site: { regionCode: "51027004", laterality: null, view: "posterior", x: 0.5, y: 0.4625, bodyDiagramVersion: "1" },
	healingPhaseCode: "granulating",
	description: "Klidné okraje",
	closedWoundTypeCode: "pressure-ulcer",
}

const SHOWN: Partial<StoreHistory> = {
	findings: [storedFinding({ woundTypeCode: "pressure-ulcer" })],
	wounds: [LAST_WOUND],
}

interface ListCall {
	patientId: string
	visible: VisibleFindings
	cursor: string | undefined
	limit: number
}

function harness(page: TrackedFindingPage, store: Partial<StoreHistory> = SHOWN) {
	const calls: ListCall[] = []
	const findings = {
		listTracked: async (patientId: string, visible: VisibleFindings, cursor: string | undefined, limit: number) => {
			calls.push({ patientId, visible, cursor, limit })
			return page
		},
	} as unknown as FindingRepository
	const configuration = {
		pageSize: async () => ({ defaultSize: DEFAULT_PAGE_SIZE, maxSize: MAX_PAGE_SIZE }),
	} as unknown as ConfigurationService
	const patients = {
		byIds: async (ids: readonly string[]) => ids.filter((id) => id === PATIENT).map((id) => foundPatient(id)),
	} as unknown as PatientRepository
	const releases: RecordRelease[] = []
	const recorder = {
		record: async (_current: never, release: RecordRelease) => {
			releases.push(release)
		},
	} as unknown as RecordReleaseService
	const service = new PatientFindingsService(
		findings,
		clinicalReadsFake(store).reads,
		configuration,
		new PatientLookupService(patients),
		recorder,
	)
	return { service, calls, releases }
}

describe("tracked findings of a patient CAP-016-R17", () => {
	it("CAP-020-R04 CAP-020-R16 lists only the findings and records the store shows", async () => {
		const run = harness({ rows: [], nextCursor: null })

		await run.service.list(CURRENT, { patient_id: PATIENT, cursor: "cursor", limit: 5 })

		expect(run.calls).toEqual([
			{
				patientId: PATIENT,
				visible: { findingIds: [FINDING_ID], acquisitionIds: [LAST_RECORD] },
				cursor: "cursor",
				limit: 5,
			},
		])
	})

	it("CAP-020-R04 asks for nothing the store does not show", async () => {
		const run = harness({ rows: [], nextCursor: null }, {})

		await run.service.list(CURRENT, { patient_id: PATIENT, cursor: undefined, limit: undefined })

		expect(run.calls).toEqual([
			{
				patientId: PATIENT,
				visible: { findingIds: [], acquisitionIds: [] },
				cursor: undefined,
				limit: DEFAULT_PAGE_SIZE,
			},
		])
	})

	it("CAP-020-R20 hands over the closed history of every finding with the next cursor", async () => {
		const run = harness({ rows: [trackedRow()], nextCursor: NEXT_CURSOR })

		const page = await run.service.list(CURRENT, { patient_id: PATIENT, cursor: undefined, limit: undefined })

		expect(page).toEqual({ items: [findingViewOf(trackedRow())], next_cursor: NEXT_CURSOR })
	})

	it("ADR-054 bod 2 shows the last state the store holds", async () => {
		const run = harness(
			{ rows: [trackedRow()], nextCursor: null },
			{ ...SHOWN, wounds: [{ ...LAST_WOUND, healingPhaseCode: "epithelising", description: undefined }] },
		)

		const page = await run.service.list(CURRENT, { patient_id: PATIENT, cursor: undefined, limit: undefined })

		expect(page.items?.[0]?.last_assessment).toEqual({ healing_phase_code: "epithelising", code_list_version: "3" })
	})

	it("CAP-020-R05 audits every release of the findings with the patient and the count, even zero", async () => {
		const run = harness({ rows: [trackedRow()], nextCursor: null })
		const empty = harness({ rows: [], nextCursor: null })

		await run.service.list(CURRENT, { patient_id: PATIENT, cursor: undefined, limit: undefined })
		await empty.service.list(CURRENT, { patient_id: PATIENT, cursor: undefined, limit: undefined })

		expect(run.releases).toEqual([
			expect.objectContaining({ objectId: PATIENT, patient: foundPatient(PATIENT), releasedItemCount: 1 }),
		])
		expect(empty.releases).toEqual([expect.objectContaining({ releasedItemCount: 0 })])
	})
	it("ADR-054 bod 5 CAP-025-R28 answers that the documentation is unavailable and audits a release of nothing", async () => {
		const run = harness({ rows: [trackedRow()], nextCursor: null }, { unavailable: true })

		const problem = await problemOf(
			run.service.list(CURRENT, { patient_id: PATIENT, cursor: undefined, limit: undefined }),
		)

		expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		expect(run.calls).toEqual([])
		expect(run.releases).toEqual([
			expect.objectContaining({ objectId: PATIENT, patient: foundPatient(PATIENT), releasedItemCount: 0 }),
		])
	})
})

describe("finding view clinical-workflow.yaml Finding", () => {
	it("CAP-020-R23 refuses to issue a finding with a closed record but no wound number (negative)", () => {
		expect(() => findingViewOf(trackedRow({ wound_number: null }))).toThrow(FINDING_ID)
	})

	it("CAP-020-R20 carries the last closed record with its assessment and body site", () => {
		expect(findingViewOf(trackedRow())).toEqual({
			finding_id: FINDING_ID,
			patient_id: PATIENT,
			number: 3,
			created_at: "2026-09-01T08:00:00.000Z",
			last_acquisition: "2026-10-01T09:30:00.000Z",
			wound_type_code: "pressure-ulcer",
			wound_type_code_list_version: "3",
			cover_image_id: "c0000000-0000-4000-8000-0000000000aa",
			last_assessment: { healing_phase_code: "granulating", code_list_version: "3", description: "Klidné okraje" },
			last_body_site: {
				region_code: "51027004",
				laterality: null,
				view: "posterior",
				x: 0.5,
				y: 0.4625,
				body_diagram_version: "1",
			},
		})
	})

	it("CAP-017-S11 leaves out the note the last record does not carry", () => {
		const view = findingViewOf(trackedRow({ last_description: null }))

		expect(view.last_assessment).toEqual({ healing_phase_code: "granulating", code_list_version: "3" })
	})

	it("CAP-017-S16 gives the note of the last record without a healing phase", () => {
		const view = findingViewOf(trackedRow({ last_healing_phase_code: null, last_assessment_code_list_version: null }))

		expect(view.last_assessment).toEqual({ description: "Klidné okraje" })
	})

	it("CAP-020-R20 leaves out an assessment and a body site the last closed record does not have", () => {
		const view = findingViewOf(
			trackedRow({
				wound_type_code: null,
				wound_type_code_list_version: null,
				last_healing_phase_code: null,
				last_description: null,
				last_assessment_code_list_version: null,
				region_code: null,
				view: null,
				x: null,
				y: null,
				body_diagram_version: null,
				cover_image_id: null,
			}),
		)

		expect(view).toEqual({
			finding_id: FINDING_ID,
			patient_id: PATIENT,
			number: 3,
			created_at: "2026-09-01T08:00:00.000Z",
			last_acquisition: "2026-10-01T09:30:00.000Z",
			wound_type_code: null,
			wound_type_code_list_version: null,
			cover_image_id: null,
		})
	})
})
