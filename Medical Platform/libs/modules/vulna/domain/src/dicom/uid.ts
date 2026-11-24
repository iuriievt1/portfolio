import { DICOM_UID_PATTERN } from "@ansora/contracts"
import { DICOM_MAPPING_FAILURE, DicomMappingError } from "./mapping-error"

// integrace-dicom.md 4, NAB-370, Q-045
const UUID_ROOT = "2.25"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function uidOfUuid(uuid: string): string {
	if (!UUID.test(uuid)) {
		throw new Error(`not a UUID: ${uuid}`)
	}
	return `${UUID_ROOT}.${BigInt(`0x${uuid.replaceAll("-", "")}`).toString()}`
}

// DICOM PS3.5 9.1, 6.2 UI
export function isUid(value: string): boolean {
	return DICOM_UID_PATTERN.test(value)
}

// DICOM PS3.5 9.1
export function uidOf(attribute: string, value: string): string {
	if (!isUid(value)) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.INVALID_VALUE, `${attribute} is not a DICOM UID`)
	}
	return value
}
