import { ENCOUNTER_STATUS } from "@ansora/contracts"
import type { Encounter } from "../../api/encounters"
import type { Texts } from "../../i18n/texts"
import { countText, fillText } from "../../utils/fill-text"
import { formatTime } from "../../utils/format-date"
import { encounterMomentOf } from "../visit/visit-view"

const FIRST = -1
const LAST = 1

const ORDER = {
	EARLIEST_FIRST: 1,
	NEWEST_FIRST: -1,
} as const

type Order = (typeof ORDER)[keyof typeof ORDER]

// CAP-014-R12, CAP-014-R19
export function todayVisitsOf(encounters: readonly Encounter[]): Encounter[] {
	const inProgress = encounters
		.filter((encounter) => encounter.status === ENCOUNTER_STATUS.IN_PROGRESS)
		.sort((left, right) => compareMoments(left.started_at, right.started_at, ORDER.NEWEST_FIRST))
	const planned = encounters
		.filter((encounter) => encounter.status === ENCOUNTER_STATUS.PLANNED)
		.sort((left, right) => compareMoments(left.scheduled_time, right.scheduled_time, ORDER.EARLIEST_FIRST))
	return [...inProgress, ...planned]
}

// CAP-014-R19, CAP-014-S13
export function todayVisitWhenOf(encounter: Encounter, texts: Texts): string {
	const moment = encounterMomentOf(encounter)
	if (moment === undefined) {
		return texts.patient.todayTimeUnknown
	}
	return fillText(texts.patient.todayAt, { time: formatTime(new Date(moment), texts.language) }, texts.language)
}

// CAP-014-R19, CAP-014-S24
export function visitRecordsOf(encounter: Encounter, texts: Texts): string | undefined {
	const count = encounter.acquisition_count
	if (count === undefined) {
		return undefined
	}
	if (count === 0) {
		return texts.patient.noRecords
	}
	return countText(texts.patient.records, count, texts.language)
}

// CAP-014-S13
function compareMoments(left: string | null | undefined, right: string | null | undefined, order: Order): number {
	const leftKnown = left !== null && left !== undefined
	const rightKnown = right !== null && right !== undefined
	if (leftKnown && rightKnown) {
		return order * (new Date(left).getTime() - new Date(right).getTime())
	}
	if (leftKnown === rightKnown) {
		return 0
	}
	return leftKnown ? FIRST : LAST
}
