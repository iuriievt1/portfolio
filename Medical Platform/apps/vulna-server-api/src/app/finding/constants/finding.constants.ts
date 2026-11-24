import type { TimelinePageView } from "../types/finding-history.types"

// clinical-workflow.yaml listPatientFindings
export const FINDINGS_PATH = "findings"

// clinical-workflow.yaml getFindingHistory, changeFindingWoundType
export const FINDING_ID_PARAMETER = "findingId"
export const HISTORY_SUBPATH = `:${FINDING_ID_PARAMETER}/history`
export const WOUND_TYPE_SUBPATH = `:${FINDING_ID_PARAMETER}/wound-type`

// CAP-020-R16, CAP-020-S10, clinical-workflow.yaml TimelinePage.source_unavailable
export const UNAVAILABLE_TIMELINE: TimelinePageView = {
	items: [],
	next_cursor: null,
	wound_type_code: null,
	wound_type_code_list_version: null,
	wound_type_changes: [],
	source_unavailable: true,
}
