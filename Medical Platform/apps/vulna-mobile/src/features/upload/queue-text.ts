import type { Texts } from "../../i18n/texts"
import { PILL_TONE } from "../../ui/pill-tone"
import { countText, fillText } from "../../utils/fill-text"
import { momentTextOf } from "../overview/overview-rows"
import type { RecordStatus } from "../visit/visit-view"
import type { OthersQueue, QueuedRecord } from "./queue-view"

export interface OthersQueueText {
	label: string
	detail: string
}

// CAP-019-R14, CAP-019-R24
export function queuedRecordStatusOf(record: QueuedRecord, texts: Texts): RecordStatus {
	return record.awaitingCount > 0
		? { tone: PILL_TONE.INFO, label: texts.queue.uploading }
		: { tone: PILL_TONE.WARN, label: texts.queue.failed }
}

// CAP-019-R08, CAP-015-R28
export function queuedRecordDetailOf(record: QueuedRecord, now: Date, texts: Texts): string {
	const shownCount = record.awaitingCount > 0 ? record.awaitingCount : record.failedCount
	return fillText(
		texts.queue.detail,
		{
			files: countText(texts.files[record.kind], shownCount, texts.language),
			captured: momentTextOf(record.capturedAt, now, texts),
		},
		texts.language,
	)
}

// CAP-019-R23, CAP-019-S08
export function othersQueueTextOf(others: OthersQueue, texts: Texts): OthersQueueText {
	const language = texts.language
	return {
		label: countText(texts.queue.others, others.recordCount, language),
		detail:
			others.failedRecordCount === 0
				? texts.queue.othersWaiting
				: countText(texts.queue.othersFailed, others.failedRecordCount, language),
	}
}
