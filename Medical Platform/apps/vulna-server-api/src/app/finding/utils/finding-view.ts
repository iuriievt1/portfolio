import { codeListSetVersionText } from "@ansora/core-server"
import type { HistoryFinding, HistoryWoundRecord } from "@ansora/vulna-domain"
import type { AssessmentView, BodySiteView, FindingView, TrackedFindingRow } from "../types/finding.types"
import { assessmentViewOf } from "./assessment-view"
import { bodySiteColumnsOf, bodySiteViewOfRow } from "./body-site-view"
import { historyWoundTypeOf } from "./closed-wound-type"

// CAP-020-R20, CAP-017-S11, CAP-017-R16
function lastAssessmentOf(row: TrackedFindingRow): AssessmentView | undefined {
	if (row.last_healing_phase_code === null && row.last_description === null) {
		return undefined
	}
	return assessmentViewOf({
		healing_phase_code: row.last_healing_phase_code,
		code_list_version: row.last_assessment_code_list_version,
		description: row.last_description,
	})
}

// CAP-016-R17, CAP-020-R20
function lastBodySiteOf(row: TrackedFindingRow): BodySiteView | undefined {
	if (
		row.region_code === null ||
		row.view === null ||
		row.x === null ||
		row.y === null ||
		row.body_diagram_version === null
	) {
		return undefined
	}
	return bodySiteViewOfRow({
		region_code: row.region_code,
		laterality: row.laterality,
		view: row.view,
		x: row.x,
		y: row.y,
		body_diagram_version: row.body_diagram_version,
	})
}

// CAP-020-R23, CAP-020-R20, clinical-workflow.yaml Finding.number
function woundNumberOf(row: TrackedFindingRow): number {
	if (row.wound_number === null) {
		throw new Error(`the finding ${row.id} has a closed record but no wound number`)
	}
	return row.wound_number
}

// clinical-workflow.yaml Finding, CAP-016-R17, CAP-020-R20
export function findingViewOf(row: TrackedFindingRow): FindingView {
	const view: FindingView = {
		finding_id: row.id,
		patient_id: row.patient_id,
		number: woundNumberOf(row),
		created_at: row.created_at.toISOString(),
		last_acquisition: row.last_closed_at.toISOString(),
		wound_type_code: row.wound_type_code,
		wound_type_code_list_version:
			row.wound_type_code_list_version === null ? null : codeListSetVersionText(row.wound_type_code_list_version),
		cover_image_id: row.cover_image_id,
	}
	const lastAssessment = lastAssessmentOf(row)
	if (lastAssessment !== undefined) {
		view.last_assessment = lastAssessment
	}
	const lastBodySite = lastBodySiteOf(row)
	if (lastBodySite !== undefined) {
		view.last_body_site = lastBodySite
	}
	return view
}

// ADR-054 bod 2, CAP-020-R03, CAP-016-R17
export function withHistoryFinding(
	row: TrackedFindingRow,
	finding: HistoryFinding,
	last: HistoryWoundRecord | undefined,
): TrackedFindingRow {
	const woundType = historyWoundTypeOf(row, finding.woundTypeCode)
	return {
		...row,
		...bodySiteColumnsOf(last?.site),
		wound_type_code: woundType.code,
		wound_type_code_list_version: woundType.codeListVersion,
		last_healing_phase_code: last?.healingPhaseCode ?? null,
		last_description: last?.description ?? null,
	}
}
