const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const FOLLOWING_DAY = 1
const ONE_MILLISECOND = 1

function dayStart(date: string, daysLater = 0): Date | undefined {
	const match = CALENDAR_DATE.exec(date)
	if (match === null) {
		return undefined
	}
	const year = Number(match[1])
	const monthIndex = Number(match[2]) - 1
	const day = Number(match[3])
	const start = new Date(year, monthIndex, day)
	if (start.getFullYear() !== year || start.getMonth() !== monthIndex || start.getDate() !== day) {
		return undefined
	}
	return new Date(year, monthIndex, day + daysLater)
}

export function isCalendarDate(text: string): boolean {
	return dayStart(text) !== undefined
}

export function startOfDay(date: string | undefined): string | undefined {
	return date === undefined ? undefined : dayStart(date)?.toISOString()
}

export function endOfDay(date: string | undefined): string | undefined {
	const next = date === undefined ? undefined : dayStart(date, FOLLOWING_DAY)
	return next === undefined ? undefined : new Date(next.getTime() - ONE_MILLISECOND).toISOString()
}
