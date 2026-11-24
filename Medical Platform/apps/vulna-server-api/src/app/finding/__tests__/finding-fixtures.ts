import type { HistoryFinding, HistoryWoundRecord } from "@ansora/vulna-domain"
import { DEPARTMENT, PATIENT, USER } from "../../encounter/__tests__/encounter-fixtures"
import type { FindingRow, TrackedFindingRow } from "../types/finding.types"
import type { TimelineRecordRow, WoundTypeChangeRow } from "../types/finding-history.types"

export const FINDING_ID = "d0000000-0000-4000-8000-000000000001"
export const RECORD_ID = "a0000000-0000-4000-8000-000000000021"
export const ORIGIN_ID = "a0000000-0000-4000-8000-000000000020"
export const SET_VERSION = 3
export const NEXT_SET_VERSION = 4

export function findingRow(overrides: Partial<FindingRow> = {}): FindingRow {
	return {
		id: FINDING_ID,
		patient_id: PATIENT,
		department_id: DEPARTMENT,
		finding_key: "b0000000-0000-4000-8000-000000000001",
		origin_acquisition_id: ORIGIN_ID,
		created_by: USER,
		created_at: new Date("2026-08-14T06:58:00Z"),
		wound_type_code: "leg-ulcer",
		wound_type_code_list_version: NEXT_SET_VERSION,
		wound_type_set_by: USER,
		...overrides,
	}
}

export function woundTypeChange(overrides: Partial<WoundTypeChangeRow> = {}): WoundTypeChangeRow {
	return {
		id: "e0000000-0000-4000-8000-000000000001",
		finding_id: FINDING_ID,
		changed_at: new Date("2026-08-20T10:00:00Z"),
		changed_by: USER,
		previous_wound_type_code: "traumatic-wound",
		previous_wound_type_code_list_version: SET_VERSION,
		wound_type_code: "leg-ulcer",
		wound_type_code_list_version: NEXT_SET_VERSION,
		...overrides,
	}
}

export function timelineRow(overrides: Partial<TimelineRecordRow> = {}): TimelineRecordRow {
	return {
		id: RECORD_ID,
		kind: "photo",
		closed_at: new Date("2026-09-12T07:10:00Z"),
		cursor_moment: "2026-09-12T07:10:00.000000Z",
		closed_wound_type_code: "leg-ulcer",
		closed_wound_type_code_list_version: NEXT_SET_VERSION,
		study_instance_uid: "2.25.42",
		accession_number: null,
		region_code: "25763004",
		laterality: "R",
		view: "anterior",
		x: 0.4,
		y: 0.8,
		body_diagram_version: "1",
		healing_phase_code: "granulating",
		assessment_code_list_version: NEXT_SET_VERSION,
		description: "Okraje klidné",
		...overrides,
	}
}

export function trackedRow(overrides: Partial<TrackedFindingRow> = {}): TrackedFindingRow {
	return {
		id: FINDING_ID,
		patient_id: PATIENT,
		wound_number: 2,
		created_at: new Date("2026-08-14T06:58:00Z"),
		last_acquisition_id: RECORD_ID,
		last_closed_at: new Date("2026-09-12T07:10:00Z"),
		cover_image_id: "c0000000-0000-4000-8000-0000000000aa",
		cursor_moment: "2026-08-14T06:58:00.000000Z",
		wound_type_code: "leg-ulcer",
		wound_type_code_list_version: NEXT_SET_VERSION,
		last_healing_phase_code: "granulating",
		last_description: null,
		last_assessment_code_list_version: NEXT_SET_VERSION,
		region_code: "25763004",
		laterality: "R",
		view: "anterior",
		x: 0.4,
		y: 0.8,
		body_diagram_version: "1",
		...overrides,
	}
}

export function storedFinding(overrides: Partial<HistoryFinding> = {}): HistoryFinding {
	return { findingId: FINDING_ID, woundTypeCode: "leg-ulcer", ...overrides }
}

export function storedWoundOf(row: TimelineRecordRow, findingId: string = FINDING_ID): HistoryWoundRecord {
	const site =
		row.region_code === null ||
		row.view === null ||
		row.x === null ||
		row.y === null ||
		row.body_diagram_version === null
			? undefined
			: {
					regionCode: row.region_code,
					laterality: row.laterality,
					view: row.view,
					x: row.x,
					y: row.y,
					bodyDiagramVersion: row.body_diagram_version,
				}
	return {
		acquisitionId: row.id,
		findingId,
		site,
		healingPhaseCode: row.healing_phase_code ?? undefined,
		description: row.description ?? undefined,
		closedWoundTypeCode: row.closed_wound_type_code ?? undefined,
	}
}
