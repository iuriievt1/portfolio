import { ASSEMBLY_FAILURE_REASON } from "@ansora/contracts"
import { DICOM_MAPPING_FAILURE } from "@ansora/vulna-domain"

export const ASSEMBLY_TASK_POLL_MILLISECONDS = 5000
// ADR-016 ř. 54
export const ASSEMBLY_TASK_LEASE_MILLISECONDS = 300_000
// CAP-022-R10, dorucovaci-jadro.md 5.2
export const TEXT_RECOGNITION_ATTEMPTS = 3

// CAP-022-R10, CAP-022-R11, dorucovaci-jadro.md 5.2
export const TEXT_RECOGNITION_FAILURE_CLASS = {
	DOCUMENT: "document",
	PAGE: "page",
	ENVIRONMENT: "environment",
} as const

// CAP-021-R41, integrace-dicom.md 3, 4, 5.7, CAP-021-R26, ADR-054 bod 4
export const ASSEMBLY_PAUSE = {
	IMPLEMENTATION_CLASS_UID_MISSING: "implementation_class_uid_missing",
	PATIENT_ID_SYSTEM_MISSING: "patient_id_system_missing",
	LANGUAGE_WITHOUT_TEXTS: "language_without_texts",
	TRANSFER_SYNTAXES_UNSUPPORTED: "transfer_syntaxes_unsupported",
	RELEASE_UNFIT: "release_unfit",
	CLINICAL_RECORD_STORE_UNCONFIGURED: "clinical_record_store_unconfigured",
} as const

// datovy-model.md 13.2
export const PATIENT_LINK = {
	RESOURCE_TYPE: "Patient",
	LOCAL_KIND: "patient",
} as const

// DICOM PS3.5 6.2 CS
export const VALUE_SEPARATOR = "\\"

// CAP-022-R11, datovy-model.md 4 „Doručení“, integrace-dicom.md 5
export const ASSEMBLY_FAILURE = {
	...DICOM_MAPPING_FAILURE,
	// CAP-022-R11
	OCR_FAILED: ASSEMBLY_FAILURE_REASON.OCR_FAILED,
	// ADR-054 bod 4
	CLINICAL_RECORD_MISSING: "clinical_record_missing",
	CLINICAL_RECORD_MISMATCH: "clinical_record_mismatch",
	// CAP-021-R35, CAP-026-R18
	MISSING_BUFFER: "missing_buffer",
	// CAP-021-R25
	INCOMPLETE_RECORD: "incomplete_record",
	// CAP-021-R26, CAP-017-R18
	UNKNOWN_CODE: "unknown_code",
} as const
