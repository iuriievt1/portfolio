// CAP-004-R13
export const ADMINISTRATION_LOCALE = "cs"

const DATE_TIME = new Intl.DateTimeFormat(ADMINISTRATION_LOCALE, { dateStyle: "medium", timeStyle: "short" })
const DATE_TIME_WITH_SECONDS = new Intl.DateTimeFormat(ADMINISTRATION_LOCALE, {
	dateStyle: "medium",
	timeStyle: "medium",
})
const TIME = new Intl.DateTimeFormat(ADMINISTRATION_LOCALE, { timeStyle: "short" })
const COUNT = new Intl.NumberFormat(ADMINISTRATION_LOCALE)

export function formatDateTime(iso: string): string {
	return DATE_TIME.format(new Date(iso))
}

// CAP-025-R04
export function formatPreciseDateTime(iso: string): string {
	return DATE_TIME_WITH_SECONDS.format(new Date(iso))
}

export function formatTime(iso: string): string {
	return TIME.format(new Date(iso))
}

export function formatCount(count: number): string {
	return COUNT.format(count)
}

export const DURATION_UNIT = {
	SECOND: "second",
	MINUTE: "minute",
	HOUR: "hour",
	DAY: "day",
} as const

export type DurationUnit = (typeof DURATION_UNIT)[keyof typeof DURATION_UNIT]

export const SECONDS_IN: Readonly<Record<DurationUnit, number>> = {
	[DURATION_UNIT.SECOND]: 1,
	[DURATION_UNIT.MINUTE]: 60,
	[DURATION_UNIT.HOUR]: 3600,
	[DURATION_UNIT.DAY]: 86_400,
}

const DURATION_UNITS_LARGEST_FIRST: readonly DurationUnit[] = [
	DURATION_UNIT.DAY,
	DURATION_UNIT.HOUR,
	DURATION_UNIT.MINUTE,
	DURATION_UNIT.SECOND,
]

export const BYTE_UNIT = {
	BYTE: "byte",
	KILOBYTE: "kilobyte",
	MEGABYTE: "megabyte",
	GIGABYTE: "gigabyte",
} as const

type ByteUnit = (typeof BYTE_UNIT)[keyof typeof BYTE_UNIT]

const BINARY_STEP = 1024

export const BYTES_IN: Readonly<Record<ByteUnit, number>> = {
	[BYTE_UNIT.BYTE]: 1,
	[BYTE_UNIT.KILOBYTE]: BINARY_STEP,
	[BYTE_UNIT.MEGABYTE]: BINARY_STEP ** 2,
	[BYTE_UNIT.GIGABYTE]: BINARY_STEP ** 3,
}

const BYTE_UNITS_LARGEST_FIRST: readonly ByteUnit[] = [
	BYTE_UNIT.GIGABYTE,
	BYTE_UNIT.MEGABYTE,
	BYTE_UNIT.KILOBYTE,
	BYTE_UNIT.BYTE,
]

const UNIT_FRACTION_DIGITS = 1
const UNIT_PART = "unit"

export const UNIT_DISPLAY = {
	LONG: "long",
	SHORT: "short",
} as const

type UnitDisplay = (typeof UNIT_DISPLAY)[keyof typeof UNIT_DISPLAY]

function unitFormat(unit: string, unitDisplay: UnitDisplay): Intl.NumberFormat {
	return new Intl.NumberFormat(ADMINISTRATION_LOCALE, {
		style: "unit",
		unit,
		unitDisplay,
		maximumFractionDigits: UNIT_FRACTION_DIGITS,
	})
}

// DESIGN.md 4.4
export function formatDuration(seconds: number): string {
	const exact = DURATION_UNITS_LARGEST_FIRST.find((unit) => seconds % SECONDS_IN[unit] === 0) ?? DURATION_UNIT.SECOND
	return unitFormat(exact, UNIT_DISPLAY.LONG).format(seconds / SECONDS_IN[exact])
}

// DESIGN.md 4.4
export function formatElapsed(seconds: number): string {
	const largest = DURATION_UNITS_LARGEST_FIRST.find((unit) => seconds >= SECONDS_IN[unit]) ?? DURATION_UNIT.SECOND
	return unitFormat(largest, UNIT_DISPLAY.LONG).format(Math.floor(seconds / SECONDS_IN[largest]))
}

export function formatDays(days: number): string {
	return unitFormat(DURATION_UNIT.DAY, UNIT_DISPLAY.LONG).format(days)
}

export function formatBytes(bytes: number): string {
	const largest = BYTE_UNITS_LARGEST_FIRST.find((unit) => bytes >= BYTES_IN[unit]) ?? BYTE_UNIT.BYTE
	return unitFormat(largest, UNIT_DISPLAY.SHORT).format(bytes / BYTES_IN[largest])
}

export function unitName(unit: DurationUnit | ByteUnit, unitDisplay: UnitDisplay, amount: number): string {
	return new Intl.NumberFormat(ADMINISTRATION_LOCALE, { style: "unit", unit, unitDisplay })
		.formatToParts(amount)
		.filter((part) => part.type === UNIT_PART)
		.map((part) => part.value)
		.join("")
		.trim()
}

const LIST = new Intl.ListFormat(ADMINISTRATION_LOCALE, { type: "conjunction" })

export function formatList(items: readonly string[]): string {
	return LIST.format(items)
}

const PLACEHOLDER = /\{(\w+)\}/g

export function fillText(text: string, values: Readonly<Record<string, string>>): string {
	return text.replace(PLACEHOLDER, (placeholder, name: string) => values[name] ?? placeholder)
}
