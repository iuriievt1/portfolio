// CAP-026-R11, dorucovaci-jadro.md 6
export const RETENTION_PERIOD_MILLISECONDS = 3_600_000
export const RETENTION_BATCH_SIZE = 500

// datovy-model.md 5, CAP-026-R15, CAP-026-R18
export const STORED_RENDITION = {
	ORIGINAL: "original",
	THUMBNAIL: "thumbnail",
	VIEWING_COPY: "viewing_copy",
	OUTPUT_PDF: "output_pdf",
	DICOM_FILE: "dicom_file",
} as const

// CAP-026-R19, datovy-model.md 8
export const RETENTION_IDENTITY = "retention"

export const REMOVAL = {
	DONE: "done",
	SKIPPED: "skipped",
	STORE_UNAVAILABLE: "store_unavailable",
} as const
