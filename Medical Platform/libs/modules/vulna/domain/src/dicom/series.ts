import { DICOM_MAPPING_FAILURE, DicomMappingError } from "./mapping-error"
import { operatorNameOf } from "./person-name"
import { uidOf } from "./uid"
import { ordinalOf, SHORT_STRING_MAX_LENGTH } from "./value-representation"

// DICOM PS3.3 C.7.3.1.1.1, integrace-dicom.md 2, NAB-364, NAB-371
export const MODALITY = {
	EXTERNAL_CAMERA_PHOTOGRAPHY: "XC",
	DOCUMENT: "DOC",
} as const

export type Modality = (typeof MODALITY)[keyof typeof MODALITY]

// integrace-dicom.md 5.3
export interface DicomSeries {
	seriesInstanceUid: string
	seriesNumber: number
	modality: Modality
	operatorsName: string
	stationName: string
}

// datovy-model.md 3, CAP-021-R11
export interface DicomSeriesSource {
	seriesInstanceUid: string
	seriesNumber: number
}

// integrace-dicom.md 5.3, CAP-021-R13
export interface DicomOperator {
	familyName: string
	givenName: string
}

// integrace-dicom.md 5.3, CAP-021-R13, NAB-380
export interface DicomStation {
	hardwareId: string
}

// NAB-517
const HARDWARE_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/

// integrace-dicom.md 5.3, CAP-021-R11, CAP-021-R13, CAP-025-R17
export function dicomSeriesOf(
	series: DicomSeriesSource,
	modality: Modality,
	operator: DicomOperator,
	station: DicomStation,
): DicomSeries {
	return {
		seriesInstanceUid: uidOf("Series Instance UID", series.seriesInstanceUid),
		seriesNumber: ordinalOf("Series Number", series.seriesNumber),
		modality,
		operatorsName: operatorNameOf(operator.familyName, operator.givenName),
		stationName: stationNameOf(station.hardwareId),
	}
}

// integrace-dicom.md 5.3, NAB-380
function stationNameOf(hardwareId: string): string {
	if (!HARDWARE_ID_PATTERN.test(hardwareId)) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.INVALID_VALUE, "the closing device has no hardware ID")
	}
	return hardwareId.slice(0, SHORT_STRING_MAX_LENGTH)
}
