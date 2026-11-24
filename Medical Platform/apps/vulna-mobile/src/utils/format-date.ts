// DESIGN.md 4.4
const TIME_ZONE = "Europe/Prague"
const CALENDAR_TIME_ZONE = "UTC"
const DAY_KEY_LANGUAGE = "en"
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_DIGITS = 2
const MONTH_OFFSET = 1

const DATE = { day: "numeric", month: "numeric", year: "numeric" } as const
const DAY_MONTH = { day: "numeric", month: "numeric" } as const
const TIME = { hour: "numeric", minute: "2-digit" } as const
const WEEKDAY = { weekday: "short" } as const
const MONTH = { month: "long", year: "numeric" } as const
const ISO_DATE_PARTS = { year: "numeric", month: "2-digit", day: "2-digit" } as const

// CAP-015-R28
export function formatDateTime(moment: Date, language: string): string {
	return formatMoment(moment, language, { ...DATE, ...TIME })
}

// CAP-015-R28
export function formatDate(moment: Date, language: string): string {
	return formatMoment(moment, language, DATE)
}

// CAP-015-R28
export function formatTime(moment: Date, language: string): string {
	return formatMoment(moment, language, TIME)
}

// CAP-015-R28
export function formatCalendarDate(isoDate: string, language: string): string {
	return formatCalendarMoment(isoDate, language, DATE)
}

// CAP-015-R28, E120
export function formatCalendarDayMonth(isoDate: string, language: string): string {
	return formatCalendarMoment(isoDate, language, DAY_MONTH)
}

// CAP-015-R28, E109
export function formatCalendarWeekday(isoDate: string, language: string): string {
	return formatCalendarMoment(isoDate, language, WEEKDAY)
}

// CAP-015-R28, E109
export function formatCalendarMonth(isoDate: string, language: string): string {
	return formatCalendarMoment(isoDate, language, MONTH)
}

// CAP-015-R28, E110
export function formatMonth(moment: Date, language: string): string {
	return formatMoment(moment, language, MONTH)
}

// CAP-015-R28
export function formatDayMonth(moment: Date, language: string): string {
	return formatMoment(moment, language, DAY_MONTH)
}

export function dayOfCalendarDate(isoDate: string): number | undefined {
	return calendarMomentOf(isoDate)?.getUTCDate()
}

export function isSameDay(moment: Date, other: Date): boolean {
	return formatMoment(moment, DAY_KEY_LANGUAGE, DATE) === formatMoment(other, DAY_KEY_LANGUAGE, DATE)
}

// CAP-014-R30, DESIGN.md 4.4
export function instanceDateOf(moment: Date): string {
	const parts = new Intl.DateTimeFormat(DAY_KEY_LANGUAGE, { ...ISO_DATE_PARTS, timeZone: TIME_ZONE }).formatToParts(
		moment,
	)
	const partOf = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
	return `${partOf("year")}-${partOf("month")}-${partOf("day")}`
}

// mobile/clinical-workflow.yaml listPatientEncounters date
export function deviceDateOf(moment: Date): string {
	const month = String(moment.getMonth() + MONTH_OFFSET).padStart(DATE_DIGITS, "0")
	const day = String(moment.getDate()).padStart(DATE_DIGITS, "0")
	return `${moment.getFullYear()}-${month}-${day}`
}

function formatMoment(moment: Date, language: string, parts: Intl.DateTimeFormatOptions): string {
	return new Intl.DateTimeFormat(language, { ...parts, timeZone: TIME_ZONE }).format(moment)
}

function formatCalendarMoment(isoDate: string, language: string, parts: Intl.DateTimeFormatOptions): string {
	const moment = calendarMomentOf(isoDate)
	if (moment === undefined) {
		return isoDate
	}
	return new Intl.DateTimeFormat(language, { ...parts, timeZone: CALENDAR_TIME_ZONE }).format(moment)
}

function calendarMomentOf(isoDate: string): Date | undefined {
	const parts = ISO_DATE.exec(isoDate)
	if (parts === null) {
		return undefined
	}
	const [, year, month, day] = parts
	return new Date(Date.UTC(Number(year), Number(month) - MONTH_OFFSET, Number(day)))
}
