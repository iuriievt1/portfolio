import { DICOM_MAPPING_FAILURE, DicomMappingError } from "./mapping-error"

// DICOM PS3.5 7.4
export const EMPTY_VALUE = ""

// DICOM PS3.5 6.2 SH, CS
export const SHORT_STRING_MAX_LENGTH = 16

// DICOM PS3.5 6.2 LO
export const LONG_STRING_MAX_LENGTH = 64

// DICOM PS3.5 6.2 PN
export const PERSON_NAME_GROUP_MAX_LENGTH = 64

// DICOM PS3.5 6.2 ST
export const SHORT_TEXT_MAX_LENGTH = 1024

// DICOM PS3.5 6.2 LT
export const LONG_TEXT_MAX_LENGTH = 10_240

// CAP-017-R17
const ELLIPSIS = "…"

const LONE_SURROGATE = /\p{Cs}/u
const HIGH_SURROGATE_AT_END = /[\uD800-\uDBFF]$/
// DICOM PS3.5 6.1.2, 6.2 SH, LO
const STRING_VALUE = /^[^\\\p{Cc}]*$/u
// DICOM PS3.5 6.1.2, 6.2 ST, LT, CAP-021-R18
const TEXT_VALUE = /^(?:[\t\r\n\f]|[^\p{Cc}])*$/u
// DICOM PS3.5 6.1.2.5.3, CAP-021-R18
const UTF8 = new TextEncoder()

// DICOM PS3.5 6.2 IS
const INTEGER_STRING_MAX = 2_147_483_647
const ORDINAL_MIN = 1

function isWellFormed(value: string): boolean {
	return !LONE_SURROGATE.test(value)
}

// CAP-017-R17
function shortenedTo(text: string, maxLength: number): string {
	const kept = text.slice(0, maxLength - ELLIPSIS.length)
	const whole = HIGH_SURROGATE_AT_END.test(kept) ? kept.slice(0, -1) : kept
	return `${whole.trimEnd()}${ELLIPSIS}`
}

// DICOM PS3.5 6.2
export function paddedLengthOf(value: string): number {
	return value.length + (UTF8.encode(value).length % 2)
}

// CAP-017-R17, DICOM PS3.5 6.2
export function fittedTo(part: string, maxLength: number, around: (part: string) => string): string | undefined {
	const whole = around(part)
	if (paddedLengthOf(whole) <= maxLength) {
		return whole
	}
	for (let room = maxLength - (whole.length - part.length); room > ELLIPSIS.length; room--) {
		const fitted = around(shortenedTo(part, room))
		if (paddedLengthOf(fitted) <= maxLength) {
			return fitted
		}
	}
	return undefined
}

// DICOM PS3.5 6.2 SH, LO
export function isStringValue(value: string, maxLength: number): boolean {
	return paddedLengthOf(value) <= maxLength && STRING_VALUE.test(value) && isWellFormed(value)
}

// DICOM PS3.5 6.2 SH, LO
export function stringValueOf(attribute: string, value: string, maxLength: number): string {
	if (!isStringValue(value, maxLength)) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.INVALID_VALUE, `${attribute} is not a DICOM string value`)
	}
	return value
}

// DICOM PS3.5 6.2 ST, LT
export function textValueOf(attribute: string, value: string, maxLength: number): string {
	const isTextValue = paddedLengthOf(value) <= maxLength && TEXT_VALUE.test(value) && isWellFormed(value)
	if (!isTextValue) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.INVALID_VALUE, `${attribute} is not a DICOM text value`)
	}
	return value
}

// DICOM PS3.5 6.2 IS, integrace-dicom.md 5.3, 5.4
export function ordinalOf(attribute: string, ordinal: number): number {
	if (!Number.isInteger(ordinal) || ordinal < ORDINAL_MIN || ordinal > INTEGER_STRING_MAX) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.INVALID_VALUE, `${attribute} is not a DICOM IS ordinal`)
	}
	return ordinal
}
