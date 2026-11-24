import type { HistoryWoundRecord } from "@ansora/vulna-domain"
import type { AssessmentView, BodySiteView } from "../types/finding.types"
import type { ClosedWoundTypeFields, RecordContentFields } from "../types/finding-history.types"
import { assessmentViewOf } from "./assessment-view"
import { bodySiteColumnsOf, bodySiteViewOfRow } from "./body-site-view"

// clinical-workflow.yaml BodySite, CAP-016-R16
export function recordBodySiteOf(fields: RecordContentFields): BodySiteView | undefined {
	if (
		fields.region_code === null ||
		fields.view === null ||
		fields.x === null ||
		fields.y === null ||
		fields.body_diagram_version === null
	) {
		return undefined
	}
	return bodySiteViewOfRow({
		region_code: fields.region_code,
		laterality: fields.laterality,
		view: fields.view,
		x: fields.x,
		y: fields.y,
		body_diagram_version: fields.body_diagram_version,
	})
}

// clinical-workflow.yaml Assessment, CAP-017-R03, CAP-017-R04, CAP-017-R16
export function recordAssessmentOf(fields: RecordContentFields): AssessmentView | undefined {
	if (fields.healing_phase_code === null && fields.description === null) {
		return undefined
	}
	return assessmentViewOf({
		healing_phase_code: fields.healing_phase_code,
		code_list_version: fields.assessment_code_list_version,
		description: fields.description,
	})
}

// ADR-054 bod 2, CAP-020-R03, CAP-020-R17
export function withHistoryWound<T extends RecordContentFields & ClosedWoundTypeFields>(
	row: T,
	wound: HistoryWoundRecord,
): T {
	const closedWoundTypeCode = wound.closedWoundTypeCode ?? null
	return {
		...row,
		...bodySiteColumnsOf(wound.site),
		healing_phase_code: wound.healingPhaseCode ?? null,
		description: wound.description ?? null,
		closed_wound_type_code: closedWoundTypeCode,
		// CAP-017-R09
		closed_wound_type_code_list_version: closedWoundTypeCode === null ? null : row.closed_wound_type_code_list_version,
	}
}
