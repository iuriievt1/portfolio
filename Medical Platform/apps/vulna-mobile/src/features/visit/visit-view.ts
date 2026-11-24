import type { AcquisitionKind } from "@ansora/contracts"
import { ACQUISITION_KIND, ACQUISITION_STATE_VALUE, ENCOUNTER_STATUS, MISSING_STEP } from "@ansora/contracts"
import type { Encounter, EncounterAcquisitionItem } from "../../api/encounters"
import type { Texts } from "../../i18n/texts"
import { PILL_TONE, type PillTone } from "../../ui/pill-tone"
import { countText, fillText, numberText } from "../../utils/fill-text"
import {
	dayOfCalendarDate,
	formatCalendarDate,
	formatCalendarDayMonth,
	formatDate,
	formatTime,
} from "../../utils/format-date"
import { RECORD_NOTE, type RecordNote } from "../upload/record-note"

export const VISIT_MODE = {
	OPEN: "open",
	EARLIER: "earlier",
	CLOSED: "closed",
} as const

export type VisitMode = (typeof VISIT_MODE)[keyof typeof VISIT_MODE]

// CAP-014-R21, CAP-014-R22, CAP-014-R30
export function visitModeOf(encounter: Encounter | undefined): VisitMode {
	if (encounter === undefined) {
		return VISIT_MODE.OPEN
	}
	if (encounter.status === ENCOUNTER_STATUS.COMPLETED) {
		return VISIT_MODE.CLOSED
	}
	if (encounter.accepts_new_records === true) {
		return VISIT_MODE.OPEN
	}
	return encounter.status === ENCOUNTER_STATUS.IN_PROGRESS ? VISIT_MODE.EARLIER : VISIT_MODE.CLOSED
}

export interface VisitWhen {
	date: string
	time: string | undefined
}

// CAP-014-R03, CAP-014-R16, CAP-014-R19, CAP-014-S13
export function encounterMomentOf(encounter: Encounter): string | undefined {
	const moment =
		encounter.status === ENCOUNTER_STATUS.PLANNED
			? encounter.scheduled_time
			: (encounter.started_at ?? encounter.scheduled_time)
	return moment ?? undefined
}

// CAP-014-R03, CAP-014-S13
export function visitWhenOf(encounter: Encounter | undefined, openedAt: Date, language: string): VisitWhen {
	if (encounter === undefined) {
		return { date: formatDate(openedAt, language), time: formatTime(openedAt, language) }
	}
	const moment = encounterMomentOf(encounter)
	return {
		date: formatCalendarDate(encounter.date, language),
		time: moment === undefined ? undefined : formatTime(new Date(moment), language),
	}
}

// E100, E101
export function visitTitleOf(when: VisitWhen, texts: Texts): string {
	return when.time === undefined
		? fillText(texts.visit.titleWithoutTime, { date: when.date }, texts.language)
		: fillText(texts.visit.title, { date: when.date, time: when.time }, texts.language)
}

// Q-150
export function visitMomentOf(when: VisitWhen, texts: Texts): string {
	return dateWithTimeOf(when, texts.visit.moment, texts.language)
}

// E102, E117
export function visitWhenTextOf(when: VisitWhen, texts: Texts): string {
	return dateWithTimeOf(when, texts.visit.when, texts.language)
}

function dateWithTimeOf(when: VisitWhen, template: string, language: string): string {
	return when.time === undefined ? when.date : fillText(template, { date: when.date, time: when.time }, language)
}

export interface RecordStatus {
	tone: PillTone
	label: string
}

// CAP-019-R27, CAP-019-R28
export function recordStatusOf(record: EncounterAcquisitionItem, texts: Texts): RecordStatus {
	switch (record.state) {
		case ACQUISITION_STATE_VALUE.DRAFT:
			return { tone: PILL_TONE.WARN, label: texts.visit.record.status.draft }
		case ACQUISITION_STATE_VALUE.RECEIVED:
			return { tone: PILL_TONE.SUCCESS, label: texts.visit.record.status.received }
		default:
			return { tone: PILL_TONE.NEUTRAL, label: texts.visit.record.status.unknown }
	}
}

// CAP-014-R22
export function recordTitleOf(record: EncounterAcquisitionItem, texts: Texts): string {
	return texts.visit.record.kind[record.kind]
}

// CAP-015-R28
export function recordFilesOf(record: EncounterAcquisitionItem, texts: Texts): string {
	return countText(texts.files[record.kind], record.file_count, texts.language)
}

// CAP-014-R22, CAP-019-R29, CAP-015-R36, E93, E101, Q-076
export function recordDetailOf(record: EncounterAcquisitionItem, texts: Texts, note: RecordNote): string {
	const language = texts.language
	const files = recordFilesOf(record, texts)
	const time = formatTime(new Date(record.updated_at), language)
	const missing = missingStepTextOf(record, texts, note)
	return missing === undefined
		? fillText(texts.visit.record.detail, { files, time }, language)
		: fillText(texts.visit.record.draftDetail, { missing, files, time }, language)
}

// CAP-015-R36, CAP-009-S05, Q-076
export function missingFileTextOf(kind: AcquisitionKind, texts: Texts): string {
	return kind === ACQUISITION_KIND.PHOTO ? texts.visit.missing.image : texts.visit.missing.page
}

// CAP-014-R20, CAP-014-R22, CAP-019-R29, CAP-015-R35, CAP-015-R36, E93, E101, E103, E111, Q-076
export function missingStepTextOf(
	record: EncounterAcquisitionItem,
	texts: Texts,
	note: RecordNote,
): string | undefined {
	const missing = texts.visit.missing
	const isDraft = record.state === ACQUISITION_STATE_VALUE.DRAFT
	if (isDraft && note === RECORD_NOTE.RETAKE) {
		return missingFileTextOf(record.kind, texts)
	}
	if (isDraft && record.files_on_other_device === true) {
		return missing.onOtherDevice
	}
	if (isDraft && note === RECORD_NOTE.CLOSING_QUEUED) {
		return missing.closingQueued
	}
	switch (record.missing_step) {
		case null:
		case undefined:
			return undefined
		case MISSING_STEP.IMAGES:
			return missing.images
		case MISSING_STEP.PAGES:
			return missing.pages
		case MISSING_STEP.FINDING:
		case MISSING_STEP.BODY_SITE:
			return missing.bodySite
		case MISSING_STEP.WOUND_TYPE:
			return missing.woundType
		case MISSING_STEP.HEALING_PHASE:
			return missing.healingPhase
		case MISSING_STEP.DOCUMENT_TITLE:
			return missing.documentTitle
		case MISSING_STEP.FILES:
			return missingFileTextOf(record.kind, texts)
		case MISSING_STEP.SUMMARY:
			return missing.summary
		default:
			return missing.unknown
	}
}

// CAP-014-R20
export function ownDraftOf(records: readonly EncounterAcquisitionItem[]): EncounterAcquisitionItem | undefined {
	return records.find((record) => record.state === ACQUISITION_STATE_VALUE.DRAFT)
}

// CAP-014-R30, E120
export function earlierNoticeOf(encounter: Encounter | undefined, texts: Texts): string | undefined {
	const isOpen = encounter?.status === ENCOUNTER_STATUS.PLANNED || encounter?.status === ENCOUNTER_STATUS.IN_PROGRESS
	if (encounter === undefined || !isOpen || encounter.accepts_new_records !== false) {
		return undefined
	}
	return earlierVisitTextOf(encounter, texts)
}

function earlierVisitTextOf(encounter: Encounter, texts: Texts): string {
	const visit = texts.visit
	return fillText(
		encounter.status === ENCOUNTER_STATUS.PLANNED ? visit.earlierPlanned : visit.earlier,
		{
			from: numberText(visit.earlierFrom, dayOfCalendarDate(encounter.date)),
			date: formatCalendarDayMonth(encounter.date, texts.language),
		},
		texts.language,
	)
}

// Q-150, CAP-014-R29
export function isCancellable(encounter: Encounter | undefined): encounter is Encounter {
	return encounter?.status === ENCOUNTER_STATUS.IN_PROGRESS
}

// Q-150
export function cancelUnavailableReasonOf(
	records: readonly EncounterAcquisitionItem[],
	texts: Texts,
): string | undefined {
	const hasClosed = records.some((record) => record.state !== ACQUISITION_STATE_VALUE.DRAFT)
	return hasClosed ? texts.visit.cancel.unavailable : undefined
}

// CAP-014-R25, CAP-014-S42
export function isMovable(record: EncounterAcquisitionItem, mode: VisitMode): boolean {
	return record.state === ACQUISITION_STATE_VALUE.DRAFT && mode !== VISIT_MODE.CLOSED
}
