// integrace-dicom.md 5, ADR-003 ř. 27
export const DICOM_MAPPING_FAILURE = {
	PATIENT_ID_SYSTEM_UNSET: "patient_id_system_unset",
	PATIENT_ID_MISSING: "patient_id_missing",
	PATIENT_ID_AMBIGUOUS: "patient_id_ambiguous",
	// DICOM PS3.5 6.2
	INVALID_VALUE: "invalid_value",
	// integrace-dicom.md 5.3, CAP-016-R08
	UNKNOWN_BODY_SITE: "unknown_body_site",
	// integrace-dicom.md 5.8, CAP-021-R26
	UNSUPPORTED_LANGUAGE: "unsupported_language",
	// integrace-dicom.md 3.1, 5.5, CAP-021-R07
	UNSUPPORTED_IMAGE: "unsupported_image",
	// CAP-021-R07, CAP-019-R14
	ROTATED_IMAGE: "rotated_image",
	// integrace-dicom.md 5.6, CAP-021-R10
	UNSUPPORTED_DOCUMENT: "unsupported_document",
} as const

export type DicomMappingFailure = (typeof DICOM_MAPPING_FAILURE)[keyof typeof DICOM_MAPPING_FAILURE]

export class DicomMappingError extends Error {
	constructor(
		readonly failure: DicomMappingFailure,
		message: string,
	) {
		super(message)
		this.name = "DicomMappingError"
	}
}
