import { ACQUISITION_KIND } from "@ansora/contracts"
import { QUEUE_NOTICE, type QueueNotice, REJECTION, rejectionOf } from "@ansora/core-mobile"
import type { AcquisitionDraftSummary } from "../../api/acquisitions"
import type { Texts } from "../../i18n/texts"
import { fillText } from "../../utils/fill-text"
import { formatDateTime } from "../../utils/format-date"

// CAP-019-R25, E55, E114
export const NOTICE_ACTION = {
	OPEN_RECORD: "open_record",
	OPEN_SUMMARY: "open_summary",
	NONE: "none",
} as const

export type NoticeAction = (typeof NOTICE_ACTION)[keyof typeof NOTICE_ACTION]

export interface QueueNoticeView {
	title: string
	body: string
	action: NoticeAction
}

interface FileNoticeTexts {
	title: string
	titleScan: string
	body: string
	bodyScan: string
}

interface FileNoticeKind {
	texts: FileNoticeTexts
	action: NoticeAction
}

// CAP-019-R14, CAP-019-S18, E27, E55, E113
function rejectionNoticeOf(code: string | null, texts: Texts): FileNoticeKind {
	const notices = texts.queueNotices
	const rejection = rejectionOf(code)
	switch (rejection) {
		case REJECTION.OPEN_RECORD:
			return { texts: notices.rejected, action: NOTICE_ACTION.OPEN_RECORD }
		case REJECTION.DECIDED:
			return { texts: notices.unused, action: NOTICE_ACTION.NONE }
		case REJECTION.UNKNOWN_RECORD:
			return { texts: notices.unknownRecord, action: NOTICE_ACTION.NONE }
		default:
			return rejection satisfies never
	}
}

function fileNoticeViewOf(notice: QueueNotice, kind: FileNoticeKind, texts: Texts): QueueNoticeView {
	const isScan = notice.recordKind === ACQUISITION_KIND.SCAN
	const time = formatDateTime(new Date(notice.capturedAt ?? notice.createdAt), texts.language)
	return {
		title: isScan ? kind.texts.titleScan : kind.texts.title,
		body: fillText(isScan ? kind.texts.bodyScan : kind.texts.body, { time }, texts.language),
		action: kind.action,
	}
}

// CAP-009-S05, ADR-038, Q-076
export function isQueueLossOf(lostAt: string | undefined, drafts: readonly AcquisitionDraftSummary[]): boolean {
	if (lostAt === undefined) {
		return false
	}
	const lostAtMs = Date.parse(lostAt)
	return drafts.some((draft) => Date.parse(draft.started_at) < lostAtMs)
}

function closureNoticeViewOf(body: string, texts: Texts): QueueNoticeView {
	return { title: texts.queueNotices.closure.title, body, action: NOTICE_ACTION.OPEN_SUMMARY }
}

// CAP-019-R25, CAP-019-R18, CAP-019-R29, CAP-019-S10, CAP-009-S05, E27, E55, E113, E114, Q-076
export function queueNoticeViewOf(notice: QueueNotice, texts: Texts): QueueNoticeView {
	const closure = texts.queueNotices.closure
	switch (notice.kind) {
		case QUEUE_NOTICE.FILE_REJECTED:
			return fileNoticeViewOf(notice, rejectionNoticeOf(notice.rejectionCode, texts), texts)
		case QUEUE_NOTICE.FILE_UNREADABLE:
			return fileNoticeViewOf(
				notice,
				{ texts: texts.queueNotices.unreadable, action: NOTICE_ACTION.OPEN_RECORD },
				texts,
			)
		case QUEUE_NOTICE.FILE_SLOWED:
			return fileNoticeViewOf(notice, { texts: texts.queueNotices.slowed, action: NOTICE_ACTION.NONE }, texts)
		case QUEUE_NOTICE.CLOSURE_CHANGED:
			return closureNoticeViewOf(closure.changed, texts)
		case QUEUE_NOTICE.CLOSURE_FILE_REJECTED:
			return closureNoticeViewOf(
				notice.recordKind === ACQUISITION_KIND.SCAN ? closure.fileRejectedScan : closure.fileRejected,
				texts,
			)
		case QUEUE_NOTICE.CLOSURE_FILE_UNREADABLE:
			return closureNoticeViewOf(
				notice.recordKind === ACQUISITION_KIND.SCAN ? closure.fileUnreadableScan : closure.fileUnreadable,
				texts,
			)
		case QUEUE_NOTICE.CLOSURE_REFUSED:
			return closureNoticeViewOf(closure.refused, texts)
		default:
			return notice.kind satisfies never
	}
}
