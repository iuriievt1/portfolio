// ADR-016, datovy-model.md 4
export const JOB_KIND = {
	ASSEMBLY: "assembly",
	DELIVERY: "delivery",
	// CAP-021-R38, ADR-054 bod 3
	CLINICAL_RECORD_WRITE: "clinical_record_write",
	// CAP-021-R36
	CLINICAL_RECORD_BINARY_UPLOAD: "clinical_record_binary_upload",
	// CAP-021-R40
	CLINICAL_RECORD_VIEWING_COPY: "clinical_record_viewing_copy",
} as const

export type JobKind = (typeof JOB_KIND)[keyof typeof JOB_KIND]

export const JOB_OBJECT_KIND = {
	ACQUISITION: "acquisition",
	DELIVERY_INSTANCE: "delivery_instance",
	// CAP-001-R31, CAP-021-R38
	ACTOR: "actor",
	// CAP-017-R20
	CODE_LIST_SET: "code_list_set",
	// CAP-021-R36, CAP-021-R37, CAP-021-R40
	IMAGE: "image",
	DOCUMENT_PAGE: "document_page",
	// CAP-021-R36, CAP-021-R39
	DOCUMENT: "document",
} as const

export const JOB_STATE = {
	WAITING: "waiting",
	RUNNING: "running",
	DONE: "done",
	FAILED: "failed",
} as const

// CAP-021-R27, CAP-021-R36, datovy-model.md 4
export const UNKNOWN_OUTCOMES_BEFORE_FAILURE = 10
