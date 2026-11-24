import { EMPTY_VALUE } from "@ansora/vulna-domain"
import type { DicomElement, DicomElements } from "@veevoy/dcmjs"

export type { DicomElement, DicomElements } from "@veevoy/dcmjs"

// DICOM PS3.5 6.2
type AsciiVr = "CS" | "DA" | "DT" | "TM" | "UI"
type EncodedVr = "LO" | "LT" | "PN" | "SH" | "ST" | "UT"
type NumberVr = "IS" | "UL" | "US"

// DICOM PS3.5 6.1.2.1, 6.2
const ASCII_VRS: readonly string[] = ["CS", "DA", "DT", "TM", "UI"]
const DEFAULT_REPERTOIRE = /^[\x20-\x7e]*$/
// DICOM PS3.5 6.2 US, UL
const MAX_NUMBER: Readonly<Record<NumberVr, number>> = { IS: 2_147_483_647, UL: 0xff_ff_ff_ff, US: 0xff_ff }

// DICOM PS3.5 6.1.2.1, 7.4
export function textElement(vr: AsciiVr | EncodedVr, value: string): DicomElement {
	if (ASCII_VRS.includes(vr) && !DEFAULT_REPERTOIRE.test(value)) {
		throw new Error(`a ${vr} value holds characters outside the default repertoire`)
	}
	return { vr, Value: value === EMPTY_VALUE ? [] : [value] }
}

// DICOM PS3.5 6.4
export function textValuesElement(vr: AsciiVr, values: readonly string[]): DicomElement {
	return { vr, Value: values.map((value) => textElement(vr, value).Value[0]) }
}

// DICOM PS3.5 6.2 IS, UL, US
export function numberElement(vr: NumberVr, value: number): DicomElement {
	if (!Number.isInteger(value) || value < 0 || value > MAX_NUMBER[vr]) {
		throw new Error(`${value} does not fit a ${vr} value`)
	}
	return { vr, Value: [value] }
}

// DICOM PS3.5 7.5
export function sequenceElement(items: readonly DicomElements[]): DicomElement {
	return { vr: "SQ", Value: [...items] }
}

// DICOM PS3.5 6.2 OB, A.4
export function bytesElement(bytes: Uint8Array): DicomElement {
	return { vr: "OB", Value: [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)] }
}
