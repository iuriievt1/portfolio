import { ENCOUNTER_STATUS } from "@ansora/contracts"
import type { Encounter } from "../../api/encounters"
import type { Texts } from "../../i18n/texts"
import { PILL_TONE, type PillTone } from "../../ui/pill-tone"
import { formatNumber } from "../../utils/fill-text"
import { dayOfCalendarDate, formatCalendarMonth, formatCalendarWeekday, formatTime } from "../../utils/format-date"
import { visitRecordsOf } from "../patient/today-visits"
import { encounterMomentOf } from "../visit/visit-view"
import { capitalizedOf, type Section, sectionsInOrder } from "./sections"

export const VISIT_SECTION = {
	TODAY: "today",
	IN_PROGRESS: "in_progress",
	MONTH: "month",
} as const

type VisitSectionKind = (typeof VISIT_SECTION)[keyof typeof VISIT_SECTION]

interface VisitSection extends Section<Encounter> {
	kind: VisitSectionKind
}

const MONTH_OF_DATE = { start: 0, end: "YYYY-MM".length } as const
const EARLIER_FIRST = -1
const LATER_FIRST = 1

// CAP-014-R24, CAP-014-R29, CAP-014-R30, E109
export function visitSectionsOf(encounters: readonly Encounter[], today: string): VisitSection[] {
	const shown = encounters.filter((encounter) => encounter.status !== ENCOUNTER_STATUS.CANCELLED).sort(newestFirst)
	const todays = shown.filter((encounter) => encounter.date === today)
	const earlier = shown.filter((encounter) => encounter.date !== today)
	const inProgress = earlier.filter((encounter) => encounter.status === ENCOUNTER_STATUS.IN_PROGRESS)
	const rest = earlier.filter((encounter) => encounter.status !== ENCOUNTER_STATUS.IN_PROGRESS)
	const months = sectionsInOrder(rest, monthOf).map(({ key, items }) => ({ kind: VISIT_SECTION.MONTH, key, items }))
	return [
		...sectionIfAny(VISIT_SECTION.TODAY, today, todays),
		...sectionIfAny(VISIT_SECTION.IN_PROGRESS, VISIT_SECTION.IN_PROGRESS, inProgress),
		...months,
	]
}

// E109
export function visitSectionTitleOf(section: VisitSection, texts: Texts): string {
	switch (section.kind) {
		case VISIT_SECTION.TODAY:
			return texts.history.today
		case VISIT_SECTION.IN_PROGRESS:
			return texts.history.inProgress
		case VISIT_SECTION.MONTH:
			return capitalizedOf(formatCalendarMonth(section.items[0]?.date ?? "", texts.language), texts.language)
		default:
			return section.kind satisfies never
	}
}

interface VisitStatus {
	tone: PillTone
	label: string
}

interface VisitRowView {
	day: string
	weekday: string
	time: string
	status: VisitStatus | undefined
	records: string | undefined
}

// CAP-014-R18, CAP-014-R24, CAP-014-S13, E109
export function visitRowOf(encounter: Encounter, texts: Texts): VisitRowView {
	const language = texts.language
	const moment = encounterMomentOf(encounter)
	const day = dayOfCalendarDate(encounter.date)
	return {
		day: day === undefined ? encounter.date : formatNumber(day, language),
		weekday: formatCalendarWeekday(encounter.date, language),
		time: moment === undefined ? texts.history.timeUnknown : formatTime(new Date(moment), language),
		status: visitStatusOf(encounter, texts),
		records: visitRecordsOf(encounter, texts),
	}
}

// FIG-49
function visitStatusOf(encounter: Encounter, texts: Texts): VisitStatus | undefined {
	switch (encounter.status) {
		case ENCOUNTER_STATUS.PLANNED:
			return { tone: PILL_TONE.INFO, label: texts.patient.status.planned }
		case ENCOUNTER_STATUS.IN_PROGRESS:
			return { tone: PILL_TONE.WARN, label: texts.patient.status.inProgress }
		default:
			return undefined
	}
}

function monthOf(encounter: Encounter): string {
	return encounter.date.slice(MONTH_OF_DATE.start, MONTH_OF_DATE.end)
}

function sectionIfAny(kind: VisitSectionKind, key: string, items: Encounter[]): VisitSection[] {
	return items.length === 0 ? [] : [{ kind, key, items }]
}

// CAP-014-R24
function newestFirst(left: Encounter, right: Encounter): number {
	if (left.date !== right.date) {
		return left.date < right.date ? LATER_FIRST : EARLIER_FIRST
	}
	const leftMoment = encounterMomentOf(left)
	const rightMoment = encounterMomentOf(right)
	if (leftMoment === undefined || rightMoment === undefined) {
		return Number(leftMoment === undefined) - Number(rightMoment === undefined)
	}
	return new Date(rightMoment).getTime() - new Date(leftMoment).getTime()
}
