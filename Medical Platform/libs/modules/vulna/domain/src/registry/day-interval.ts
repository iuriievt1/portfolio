import type { DayInterval } from "../ports/registry-source.port"

// DESIGN.md 4.4
export const INSTANCE_TIME_ZONE = "Europe/Prague"

const ISO_DAY_LOCALE = "en-CA"
const MILLISECONDS_PER_DAY = 86_400_000
const ISO_DAY_LENGTH = "YYYY-MM-DD".length

export function calendarDayIn(timeZone: string, moment: Date): string {
	return new Intl.DateTimeFormat(ISO_DAY_LOCALE, {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(moment)
}

function dayNumberOf(day: string): number {
	return Date.parse(`${day}T00:00:00Z`) / MILLISECONDS_PER_DAY
}

function dayOf(dayNumber: number): string {
	return new Date(dayNumber * MILLISECONDS_PER_DAY).toISOString().slice(0, ISO_DAY_LENGTH)
}

export function shiftedDay(day: string, days: number): string {
	return dayOf(dayNumberOf(day) + days)
}

// CAP-024-R14
export function syncWindowOf(today: string, daysBack: number, daysAhead: number): DayInterval {
	return { from: shiftedDay(today, -daysBack), to: shiftedDay(today, daysAhead) }
}

export function dayCountOf(interval: DayInterval): number {
	return dayNumberOf(interval.to) - dayNumberOf(interval.from) + 1
}

// CAP-024-R14, CAP-024-S03
export function halvesOf(interval: DayInterval): [DayInterval, DayInterval] | undefined {
	const days = dayCountOf(interval)
	if (days <= 1) {
		return undefined
	}
	const lastOfFirst = shiftedDay(interval.from, Math.floor(days / 2) - 1)
	return [
		{ from: interval.from, to: lastOfFirst },
		{ from: shiftedDay(lastOfFirst, 1), to: interval.to },
	]
}

const OFFSET_LOCALE = "en-US"
const GMT_OFFSET = /GMT([+-]\d{2}:\d{2})?/
const UTC_OFFSET = "+00:00"

function offsetIn(timeZone: string, moment: Date): string {
	const part = new Intl.DateTimeFormat(OFFSET_LOCALE, { timeZone, timeZoneName: "longOffset" })
		.formatToParts(moment)
		.find((candidate) => candidate.type === "timeZoneName")
	return GMT_OFFSET.exec(part?.value ?? "")?.[1] ?? UTC_OFFSET
}

// CAP-014-R16, CAP-014-S13
export function momentOfDayTime(day: string, time: string, timeZone: string): string {
	const guess = new Date(`${day}T${time}Z`)
	const offset = offsetIn(timeZone, new Date(`${day}T${time}${offsetIn(timeZone, guess)}`))
	return new Date(`${day}T${time}${offset}`).toISOString()
}
