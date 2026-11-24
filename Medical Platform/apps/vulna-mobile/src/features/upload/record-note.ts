import type { EncounterAcquisitionItem } from "../../api/encounters"

// CAP-019-R29, CAP-015-R36, CAP-009-S05, E93, Q-076
export const RECORD_NOTE = {
	NONE: "none",
	CLOSING_QUEUED: "closing_queued",
	RETAKE: "retake",
} as const

export type RecordNote = (typeof RECORD_NOTE)[keyof typeof RECORD_NOTE]

// CAP-019-R29, CAP-015-R36, Q-076
export interface QueuedRecordMarks {
	closings: ReadonlySet<string>
	retakes: ReadonlySet<string>
}

const NO_FILES = 0

type NotedRecord = Pick<EncounterAcquisitionItem, "acquisition_id" | "rejected_file_count">

// CAP-015-R36, CAP-019-R29, CAP-009-S05, E93, Q-076
export function recordNoteOf(record: NotedRecord, marks: QueuedRecordMarks): RecordNote {
	const acquisitionId = record.acquisition_id
	if ((record.rejected_file_count ?? NO_FILES) > NO_FILES || marks.retakes.has(acquisitionId)) {
		return RECORD_NOTE.RETAKE
	}
	return marks.closings.has(acquisitionId) ? RECORD_NOTE.CLOSING_QUEUED : RECORD_NOTE.NONE
}
