import { ERROR_CODE } from "@ansora/contracts"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import { clinicalReadsFake, type StoreHistory } from "../../clinical-record/__tests__/clinical-read-fixtures"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { CURRENT, fakeDatabase, foundPatient, PATIENT, problemOf } from "../../encounter/__tests__/encounter-fixtures"
import { recordFile } from "../../image/__tests__/image-fixtures"
import type { RecordFileRepository } from "../../image/repositories/record-file.repository"
import type { RecordReleaseService } from "../../image/services/record-release.service"
import type { RecordFileRow, RecordRelease } from "../../image/types/image.types"
import type { PatientRepository } from "../../registry/repositories/patient.repository"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { FindingRepository } from "../repositories/finding.repository"
import type { FindingHistoryRepository } from "../repositories/finding-history.repository"
import type { WoundTypeChangeRepository } from "../repositories/wound-type-change.repository"
import { FindingHistoryService } from "../services/finding-history.service"
import type { FindingRow } from "../types/finding.types"
import type { TimelineItemView, TimelineRecordRow, WoundTypeChangeRow } from "../types/finding-history.types"
import {
	FINDING_ID,
	findingRow,
	RECORD_ID,
	storedFinding,
	storedWoundOf,
	timelineRow,
	woundTypeChange,
} from "./finding-fixtures"

const OLDER_RECORD = "a0000000-0000-4000-8000-000000000019"
const PAGE_SIZE = { defaultSize: 20, maxSize: 50 }
const NEXT_CURSOR = "next"

interface Setup {
	finding: FindingRow | undefined
	records: TimelineRecordRow[]
	files: RecordFileRow[]
	changes: WoundTypeChangeRow[]
	store: Partial<StoreHistory>
}

interface ListCall {
	findingId: string
	visibleAcquisitionIds: readonly string[]
	cursor: string | undefined
	limit: number
}

function shownByStore(records: readonly TimelineRecordRow[]): Partial<StoreHistory> {
	return { findings: [storedFinding()], wounds: records.map((record) => storedWoundOf(record)) }
}

function harness(setup: Partial<Setup> = {}) {
	const records = setup.records ?? []
	const state: Setup = {
		finding: findingRow(),
		records,
		files: [],
		changes: [],
		store: shownByStore(records),
		...setup,
	}
	const releases: RecordRelease[] = []
	const calls: ListCall[] = []
	const findings = { findById: async () => state.finding } as unknown as FindingRepository
	const history = {
		closedRecords: async (
			findingId: string,
			visibleAcquisitionIds: readonly string[],
			cursor: string | undefined,
			limit: number,
		) => {
			calls.push({ findingId, visibleAcquisitionIds, cursor, limit })
			return { rows: state.records.filter((row) => visibleAcquisitionIds.includes(row.id)), nextCursor: NEXT_CURSOR }
		},
	} as unknown as FindingHistoryRepository
	const changes = { listOf: async () => state.changes } as unknown as WoundTypeChangeRepository
	const files = {
		imagesOf: async (_sql: never, ids: readonly string[]) =>
			state.files.filter((file) => ids.includes(file.acquisition_id)),
	} as unknown as RecordFileRepository
	const patients = {
		byIds: async (ids: readonly string[]) => ids.filter((id) => id === PATIENT).map((id) => foundPatient(id)),
	} as unknown as PatientRepository
	const recorder = {
		record: async (_current: never, release: RecordRelease) => {
			releases.push(release)
		},
	} as unknown as RecordReleaseService
	const configuration = { pageSize: async () => PAGE_SIZE } as unknown as ConfigurationService
	const service = new FindingHistoryService(
		fakeDatabase(),
		findings,
		clinicalReadsFake(state.store).reads,
		history,
		changes,
		files,
		new PatientLookupService(patients),
		recorder,
		configuration,
	)
	return { service, releases, calls }
}

describe("timeline of a finding CAP-020-R01", () => {
	it("CAP-020-S01 CAP-020-S08 lists the closed records the store shows newest first with the type and its changes", async () => {
		const run = harness({
			records: [
				timelineRow(),
				timelineRow({
					id: OLDER_RECORD,
					closed_at: new Date("2026-08-14T06:58:00Z"),
					closed_wound_type_code: "traumatic-wound",
				}),
			],
			files: [recordFile({ acquisition_id: RECORD_ID })],
			changes: [woundTypeChange()],
		})

		const page = await run.service.timeline(CURRENT, FINDING_ID, { cursor: "cursor", limit: 5 })

		expect(run.calls).toEqual([
			{ findingId: FINDING_ID, visibleAcquisitionIds: [RECORD_ID, OLDER_RECORD], cursor: "cursor", limit: 5 },
		])
		const items = page.items as TimelineItemView[]
		expect(items.map((item) => [item.acquisition_id, item.wound_type_code, item.images?.length])).toEqual([
			[RECORD_ID, "leg-ulcer", 1],
			[OLDER_RECORD, "traumatic-wound", 0],
		])
		expect(page).toEqual(
			expect.objectContaining({
				next_cursor: NEXT_CURSOR,
				wound_type_code: "leg-ulcer",
				wound_type_code_list_version: "4",
				wound_type_changes: [
					{
						changed_at: "2026-08-20T10:00:00.000Z",
						previous_wound_type_code: "traumatic-wound",
						wound_type_code: "leg-ulcer",
					},
				],
				source_unavailable: false,
			}),
		)
	})

	it("ADR-054 bod 2 shows the clinical content the store holds", async () => {
		const record = timelineRow()
		const run = harness({
			records: [record],
			store: {
				findings: [storedFinding()],
				wounds: [{ ...storedWoundOf(record), healingPhaseCode: "epithelising", description: undefined }],
			},
		})

		const page = await run.service.timeline(CURRENT, FINDING_ID, {})

		expect((page.items as TimelineItemView[])[0]?.assessment).toEqual({
			healing_phase_code: "epithelising",
			code_list_version: "4",
		})
	})

	it("CAP-020-R19 leaves out the code list version of a type the store holds differently", async () => {
		const run = harness({ store: { findings: [storedFinding({ woundTypeCode: "pressure-ulcer" })] } })

		const page = await run.service.timeline(CURRENT, FINDING_ID, {})

		expect(page.wound_type_code).toBe("pressure-ulcer")
		expect(page.wound_type_code_list_version).toBeNull()
	})

	it("CAP-020-R05 audits the release of the timeline with the patient and the count", async () => {
		const run = harness({ records: [timelineRow()] })

		await run.service.timeline(CURRENT, FINDING_ID, {})

		expect(run.releases).toEqual([
			{
				kind: undefined,
				objectId: FINDING_ID,
				patient: foundPatient(PATIENT),
				encounterId: undefined,
				acquisitionId: undefined,
				releasedItemCount: 1,
			},
		])
	})

	it("CAP-020-S03 CAP-020-S09 CAP-020-S21 answers a finding the store does not show as not found", async () => {
		const run = harness({ records: [timelineRow()], store: {} })

		const problem = await problemOf(run.service.timeline(CURRENT, FINDING_ID, {}))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
		expect(problem.code).toBe(ERROR_CODE.RESOURCE_NOT_FOUND)
		expect(run.calls).toEqual([])
		expect(run.releases).toEqual([expect.objectContaining({ releasedItemCount: 0 })])
	})

	it("CAP-020-S10 answers an unavailable store with an empty timeline, not a failure of the connection", async () => {
		const run = harness({ records: [timelineRow()], changes: [woundTypeChange()], store: { unavailable: true } })

		const page = await run.service.timeline(CURRENT, FINDING_ID, {})

		expect(page).toEqual({
			items: [],
			next_cursor: null,
			wound_type_code: null,
			wound_type_code_list_version: null,
			wound_type_changes: [],
			source_unavailable: true,
		})
		expect(run.calls).toEqual([])
		expect(run.releases).toEqual([expect.objectContaining({ releasedItemCount: 0 })])
	})

	it("answers an unknown finding as not found and audits it without a patient", async () => {
		const run = harness({ finding: undefined })

		const problem = await problemOf(run.service.timeline(CURRENT, FINDING_ID, {}))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
		expect(run.releases).toEqual([expect.objectContaining({ patient: undefined, releasedItemCount: 0 })])
	})
})
