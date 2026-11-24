import type { RecordProgress } from "../types/encounter.types"

export const ENCOUNTERS_PATH = "encounters"
export const SCHEDULED_PATH = "scheduled"
// clinical-workflow.yaml listUnfinishedEncounters
export const UNFINISHED_PATH = "unfinished"
export const ENCOUNTER_ID_PARAMETER = "encounterId"
export const ACQUISITIONS_SUBPATH = `:${ENCOUNTER_ID_PARAMETER}/acquisitions`
export const COMPLETION_SUBPATH = `:${ENCOUNTER_ID_PARAMETER}/completion`
export const CANCELLATION_SUBPATH = `:${ENCOUNTER_ID_PARAMETER}/cancellation`

// CAP-014-R06
export const ONE_ENCOUNTER_MESSAGE = "exactly one of encounter_id and encounter_key"

// CAP-014-R22, CAP-015-R29, CAP-021-R25
export const NO_FILES = 0

// CAP-014-R22, CAP-015-R35, CAP-015-R36
export const NO_PROGRESS: RecordProgress = {
	has_wound_type: false,
	has_healing_phase: false,
	has_document_title: false,
	received_count: NO_FILES,
	announced_count: NO_FILES,
	rejected_count: NO_FILES,
	files_on_other_device: false,
}
