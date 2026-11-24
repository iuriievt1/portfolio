import { ACQUISITION_KIND } from "@ansora/contracts"
import { ACQUISITION_STATE, type HistoryScanRecord, type HistoryWoundRecord } from "@ansora/vulna-domain"
import { DEPARTMENT, ENCOUNTER, PATIENT, USER } from "../../encounter/__tests__/encounter-fixtures"
import { FINDING_ID } from "../../finding/__tests__/finding-fixtures"
import type { DetailRecordRow } from "../types/acquisition-detail.types"

export const DETAIL_RECORD = "a0000000-0000-4000-8000-000000000040"
export const CLOSED_AT = new Date("2026-08-27T08:12:00Z")

export function photoRecord(overrides: Partial<DetailRecordRow> = {}): DetailRecordRow {
	return {
		id: DETAIL_RECORD,
		kind: ACQUISITION_KIND.PHOTO,
		state: ACQUISITION_STATE.RECEIVED,
		operator_user_id: USER,
		department_id: DEPARTMENT,
		patient_id: PATIENT,
		encounter_id: ENCOUNTER,
		finding_id: FINDING_ID,
		closed_at: CLOSED_AT,
		closed_wound_type_code: "leg-ulcer",
		closed_wound_type_code_list_version: 4,
		region_code: "25763004",
		laterality: "R",
		view: "anterior",
		x: 0.4,
		y: 0.8,
		body_diagram_version: "1",
		healing_phase_code: "sloughy",
		assessment_code_list_version: 4,
		description: "Spodina krytá fibrinovým povlakem.",
		title_code: null,
		title_text: null,
		title_code_list_version: null,
		...overrides,
	}
}

export function scanRecord(overrides: Partial<DetailRecordRow> = {}): DetailRecordRow {
	return photoRecord({
		kind: ACQUISITION_KIND.SCAN,
		finding_id: null,
		closed_wound_type_code: null,
		closed_wound_type_code_list_version: null,
		region_code: null,
		laterality: null,
		view: null,
		x: null,
		y: null,
		body_diagram_version: null,
		healing_phase_code: null,
		assessment_code_list_version: null,
		description: null,
		title_code: null,
		title_text: "Lékařská zpráva",
		...overrides,
	})
}

export function storeWoundOf(record: DetailRecordRow): HistoryWoundRecord {
	const site =
		record.region_code === null ||
		record.view === null ||
		record.x === null ||
		record.y === null ||
		record.body_diagram_version === null
			? undefined
			: {
					regionCode: record.region_code,
					laterality: record.laterality,
					view: record.view,
					x: record.x,
					y: record.y,
					bodyDiagramVersion: record.body_diagram_version,
				}
	return {
		acquisitionId: record.id,
		findingId: record.finding_id ?? undefined,
		site,
		healingPhaseCode: record.healing_phase_code ?? undefined,
		description: record.description ?? undefined,
		closedWoundTypeCode: record.closed_wound_type_code ?? undefined,
	}
}

export function storeScanOf(record: DetailRecordRow, pageCount: number): HistoryScanRecord {
	return {
		acquisitionId: record.id,
		documentId: `document of ${record.id}`,
		closedAt: (record.closed_at ?? CLOSED_AT).toISOString(),
		title: { code: record.title_code ?? undefined, text: record.title_text ?? undefined },
		pageCount,
	}
}
