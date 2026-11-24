import type { components } from "./generated/administration"

export type AdministratorAlertKind = components["schemas"]["AdministratorAlertKind"]

export type OperationalMetrics = components["schemas"]["OperationalMetrics"]

export type DependencyState = NonNullable<OperationalMetrics["dependencies"]>[string]

// CAP-028-R05, administration.yaml OperationalMetrics.dependencies
export const DEPENDENCY_STATE = {
	AVAILABLE: "available",
	UNAVAILABLE: "unavailable",
	UNKNOWN: "unknown",
} as const satisfies Record<string, DependencyState>

// CAP-028-R20, administration.yaml OperationalMetrics.dependencies
export const MONITORED_DEPENDENCY = {
	DATABASE: "database",
	IDENTITY_PROVIDER: "identity_provider",
	CLINICAL_RECORD_STORE: "clinical_record_store",
} as const

export type MonitoredDependency = (typeof MONITORED_DEPENDENCY)[keyof typeof MONITORED_DEPENDENCY]

// CAP-028-R15, administration.yaml AdministratorAlertKind
export const ADMINISTRATOR_ALERT_KIND = {
	PERMANENT_DELIVERY_FAILURE: "permanent_delivery_failure",
	HELD_FOR_REVIEW: "held_for_review",
	STORED_WITH_WARNING: "stored_with_warning",
	VERIFICATION_REJECTED: "verification_rejected",
	TARGET_PAUSED: "target_paused",
	TARGET_UNAVAILABILITY: "target_unavailability",
	ASSEMBLY_FAILED: "assembly_failed",
	ASSEMBLY_PAUSED: "assembly_paused",
	ORPHANED_OBJECTS_SET_ASIDE: "orphaned_objects_set_aside",
	AUDIT_CHAIN_BROKEN: "audit_chain_broken",
	STALE_ACQUISITION_DRAFTS: "stale_acquisition_drafts",
	CLINICAL_RECORD_STORE_UNAVAILABLE: "clinical_record_store_unavailable",
	// CAP-021-R27
	CLINICAL_RECORD_WRITE_FAILED: "clinical_record_write_failed",
	CLINICAL_RECORD_BINARY_UPLOAD_FAILED: "clinical_record_binary_upload_failed",
	VIEWING_COPY_GENERATION_FAILED: "viewing_copy_generation_failed",
} as const satisfies Record<string, AdministratorAlertKind>

export type ClinicalRecordWriteObjectKind = NonNullable<
	components["schemas"]["AdministratorAlert"]["clinical_record_write"]
>["object_kind"]

// CAP-001-R31, CAP-017-R20, CAP-021-R37, CAP-021-R39, administration.yaml AdministratorAlert
export const CLINICAL_RECORD_WRITE_OBJECT_KIND = {
	ACTOR: "actor",
	CODE_LIST_SET: "code_list_set",
	IMAGE: "image",
	DOCUMENT_PAGE: "document_page",
	DOCUMENT: "document",
	// CAP-021-R28, backend.md 3 T4
	ACQUISITION: "acquisition",
} as const satisfies Record<string, ClinicalRecordWriteObjectKind>

type ClinicalRecordBinaryUpload = NonNullable<
	components["schemas"]["AdministratorAlert"]["clinical_record_binary_upload"]
>

// CAP-021-R36, CAP-021-R40, administration.yaml AdministratorAlert
export const BINARY_UPLOAD_RECORD_KIND = {
	ACQUISITION: "acquisition",
	DOCUMENT: "document",
} as const satisfies Record<string, ClinicalRecordBinaryUpload["record_kind"]>

export type BinaryRendition = NonNullable<ClinicalRecordBinaryUpload["rendition"]>

// CAP-021-R36, CAP-021-R39, CAP-021-R40, administration.yaml AdministratorAlert.clinical_record_binary_upload.rendition
export const BINARY_RENDITION = {
	ORIGINAL: "original",
	THUMBNAIL: "thumbnail",
	VIEWING_COPY: "viewing_copy",
	OUTPUT_PDF: "output_pdf",
} as const satisfies Record<string, BinaryRendition>
