import type { FileCountRow } from "../../acquisition/types/acquisition-file.types"
import { NO_FILES, NO_PROGRESS } from "../constants/encounter.constants"
import type { RecordContentRow, RecordProgress } from "../types/encounter.types"

// CAP-014-R22, CAP-015-R35, CAP-015-R36
export function recordProgressOf(
	content: RecordContentRow | undefined,
	counts: FileCountRow | undefined,
): RecordProgress {
	return {
		has_wound_type: content?.has_wound_type ?? NO_PROGRESS.has_wound_type,
		has_healing_phase: content?.has_healing_phase ?? NO_PROGRESS.has_healing_phase,
		has_document_title: content?.has_document_title ?? NO_PROGRESS.has_document_title,
		received_count: counts?.received ?? NO_FILES,
		announced_count: counts?.announced ?? NO_FILES,
		rejected_count: counts?.rejected ?? NO_FILES,
		files_on_other_device: (counts?.announced_elsewhere ?? NO_FILES) > NO_FILES,
	}
}
