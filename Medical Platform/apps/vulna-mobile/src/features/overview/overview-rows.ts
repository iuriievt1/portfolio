import type { AcquisitionDraftSummary } from "../../api/acquisitions"
import type { Encounter, UnfinishedEncounterItem } from "../../api/encounters"
import type { RecentPatientItem } from "../../api/patients"
import type { Texts } from "../../i18n/texts"
import { countText, fillText } from "../../utils/fill-text"
import { formatDate, formatDateTime, formatTime, isSameDay } from "../../utils/format-date"
import { RECORD_NOTE, type RecordNote } from "../upload/record-note"
import { missingFileTextOf } from "../visit/visit-view"

// CAP-015-R29, CAP-019-R29, CAP-015-R36, E91, E93, Q-076
export function draftDetailOf(draft: AcquisitionDraftSummary, now: Date, texts: Texts, note: RecordNote): string {
	const language = texts.language
	const files = countText(texts.files[draft.kind], draft.file_count, language)
	const changed = momentTextOf(new Date(draft.updated_at), now, texts)
	switch (note) {
		case RECORD_NOTE.RETAKE:
			return fillText(
				texts.overview.draftDetailNote,
				{ files, changed, note: missingFileTextOf(draft.kind, texts) },
				language,
			)
		case RECORD_NOTE.CLOSING_QUEUED:
			return fillText(
				texts.overview.draftDetailNote,
				{ files, changed, note: texts.visit.missing.closingQueued },
				language,
			)
		case RECORD_NOTE.NONE:
			return fillText(texts.overview.draftDetail, { files, changed }, language)
		default:
			return note satisfies never
	}
}

// CAP-015-R18, CAP-015-S15, E57
export function waitingSinceOf(draft: AcquisitionDraftSummary, texts: Texts): string | undefined {
	if (draft.reminder_due !== true) {
		return undefined
	}
	return fillText(
		texts.overview.waitingSince,
		{ date: formatDate(new Date(draft.updated_at), texts.language) },
		texts.language,
	)
}

// CAP-015-R28
export function momentTextOf(moment: Date, now: Date, texts: Texts): string {
	if (isSameDay(moment, now)) {
		return fillText(texts.overview.todayAt, { time: formatTime(moment, texts.language) }, texts.language)
	}
	return formatDateTime(moment, texts.language)
}

// clinical-workflow.yaml UnfinishedEncounterItem, CAP-014-R18, CAP-015-R28
export function unfinishedVisitDetailOf(item: UnfinishedEncounterItem, now: Date, texts: Texts): string {
	const changed = momentTextOf(new Date(item.last_documented_at), now, texts)
	return fillText(texts.overview.unfinishedVisit, { changed }, texts.language)
}

// clinical-workflow.yaml RecentPatientItem, CAP-015-R28
export function recentDetailOf(item: RecentPatientItem, now: Date, texts: Texts): string {
	return momentTextOf(new Date(item.last_documented_at), now, texts)
}

interface ShownDrafts<Draft> {
	rows: readonly Draft[]
	hasMore: boolean
}

// CAP-015-R29
export function shownDraftsOf<Draft>(drafts: readonly Draft[], maxRows: number | undefined): ShownDrafts<Draft> {
	if (maxRows === undefined || drafts.length <= maxRows) {
		return { rows: drafts, hasMore: false }
	}
	return { rows: drafts.slice(0, maxRows), hasMore: true }
}

export interface ScheduledTime {
	text: string
	isKnown: boolean
}

// CAP-014-R16, CAP-014-S13
export function scheduledTimeOf(encounter: Encounter, texts: Texts): ScheduledTime {
	const scheduled = encounter.scheduled_time
	return scheduled === null || scheduled === undefined
		? { text: texts.overview.timeUnknown, isKnown: false }
		: { text: formatTime(new Date(scheduled), texts.language), isKnown: true }
}
