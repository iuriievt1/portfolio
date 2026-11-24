export const ACQUISITIONS_PATH = "acquisitions"
export const ACQUISITION_ID_PARAMETER = "acquisitionId"
export const ACQUISITION_SUBPATH = `:${ACQUISITION_ID_PARAMETER}`
export const ASSIGNMENT_SUBPATH = `:${ACQUISITION_ID_PARAMETER}/assignment`

// CAP-015-R18
export const DRAFT_LIMIT_LOCK = "draft_limit"

// datovy-model.md 3
export const FIRST_SERIES_NUMBER = 1

// CAP-021-R29, CAP-014-R06
export const RACE_RETRIES = 1

// clinical-workflow.yaml BodySite
export const BODY_REGION_CODE_MAX_LENGTH = 64
export const BODY_DIAGRAM_VERSION_MAX_LENGTH = 64

// datovy-model.md 4
export const DECISION_REASON = {
	DISCARDED: "discarded",
	CANCELLED: "cancelled",
} as const
