import { DICOM_MAPPING_FAILURE, DicomMappingError } from "./mapping-error"
import { EMPTY_VALUE, LONG_STRING_MAX_LENGTH, stringValueOf } from "./value-representation"

// integrace-dicom.md 5.7
export interface DicomEquipment {
	manufacturer: string
	manufacturerModelName: string
	softwareVersions: string
}

// integrace-dicom.md 5.7, ADR-001 ř. 33
const MANUFACTURER = "veevoy"
const MANUFACTURER_MODEL_NAME = "Ansora Vulna Server"

// integrace-dicom.md 5.7, NAB-388, NAB-389, CAP-021-R18
export const SPECIFIC_CHARACTER_SET = "ISO_IR 192"

// integrace-dicom.md 5.7
export function dicomEquipmentOf(softwareVersion: string): DicomEquipment {
	if (softwareVersion.trim() === EMPTY_VALUE) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.INVALID_VALUE, "Software Versions is empty")
	}
	return {
		manufacturer: MANUFACTURER,
		manufacturerModelName: MANUFACTURER_MODEL_NAME,
		softwareVersions: stringValueOf("Software Versions", softwareVersion, LONG_STRING_MAX_LENGTH),
	}
}
