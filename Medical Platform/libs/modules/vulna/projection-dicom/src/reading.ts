import { data } from "@veevoy/dcmjs"
import { TAG } from "./tags"

// DICOM PS3.10 7
const READ_OPTIONS = {
	ignoreErrors: false,
	untilTag: TAG.PATIENT_ID,
	includeUntilTagValue: true,
	noCopy: false,
	forceStoreRaw: false,
}

// integrace-dicom.md 5.1, 9, CAP-023-R13, CAP-023-S20
export function patientIdOf(part10: Uint8Array): string | undefined {
	const copy = new Uint8Array(part10)
	const value = data.DicomMessage.readFile(copy.buffer, READ_OPTIONS).dict[TAG.PATIENT_ID]?.Value[0]
	return typeof value === "string" ? value : undefined
}
