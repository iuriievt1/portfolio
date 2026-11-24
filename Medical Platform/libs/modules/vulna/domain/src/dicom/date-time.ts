import { DICOM_MAPPING_FAILURE, DicomMappingError } from "./mapping-error"

// DICOM PS3.5 6.2 DA
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH_FROM_ZERO = 1

// DICOM PS3.5 6.2 DA, TM, DT
const PARTS_LOCALE = "en-US"
const TWO_DIGITS = "2-digit"
const HOURS_FROM_ZERO = "h23"
const DICOM_DATE_PATTERN = /^\d{8}$/
const DICOM_TIME_PATTERN = /^\d{6}$/

// DICOM PS3.5 6.2 DA, TM
export interface DicomMoment {
	date: string
	time: string
}

// DICOM PS3.5 6.2 DA
export function dicomDateOf(attribute: string, isoDate: string): string {
	const [, year, month, day] = ISO_DATE_PATTERN.exec(isoDate) ?? []
	const isCalendarDate =
		year !== undefined &&
		new Date(Date.UTC(Number(year), Number(month) - MONTH_FROM_ZERO, Number(day))).toISOString().startsWith(isoDate)
	if (!isCalendarDate) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.INVALID_VALUE, `${attribute} is not an ISO date`)
	}
	return `${year}${month}${day}`
}

// DICOM PS3.5 6.2 DA, TM, DT, integrace-dicom.md 5.8, CAP-015-R28
export function dicomMomentIn(timeZone: string, moment: Date): DicomMoment {
	if (Number.isNaN(moment.getTime())) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.INVALID_VALUE, "a DICOM date and time needs a valid moment")
	}
	const parts = new Intl.DateTimeFormat(PARTS_LOCALE, {
		timeZone,
		year: "numeric",
		month: TWO_DIGITS,
		day: TWO_DIGITS,
		hour: TWO_DIGITS,
		minute: TWO_DIGITS,
		second: TWO_DIGITS,
		hourCycle: HOURS_FROM_ZERO,
	}).formatToParts(moment)
	const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((candidate) => candidate.type === type)?.value
	const date = `${part("year")}${part("month")}${part("day")}`
	const time = `${part("hour")}${part("minute")}${part("second")}`
	const fitsDicom = DICOM_DATE_PATTERN.test(date) && DICOM_TIME_PATTERN.test(time)
	if (!fitsDicom) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.INVALID_VALUE, "the moment does not fit DICOM DA and TM")
	}
	return { date, time }
}
