import { ACQUISITION_ID_PARAMETER } from "./acquisition.constants"

export const FILE_KEY_PARAMETER = "fileKey"

// clinical-workflow.yaml paths
export const FILES_SUBPATH = `:${ACQUISITION_ID_PARAMETER}/files`
export const FILE_SUBPATH = `:${ACQUISITION_ID_PARAMETER}/files/:${FILE_KEY_PARAMETER}`
export const FILE_ORDER_SUBPATH = `:${ACQUISITION_ID_PARAMETER}/file-order`
export const IMAGES_SUBPATH = `:${ACQUISITION_ID_PARAMETER}/images`
export const DOCUMENTS_SUBPATH = `:${ACQUISITION_ID_PARAMETER}/documents`
export const CLOSURE_SUBPATH = `:${ACQUISITION_ID_PARAMETER}/closure`
export const DISCARD_SUBPATH = `:${ACQUISITION_ID_PARAMETER}/discard`
export const CANCELLATION_SUBPATH = `:${ACQUISITION_ID_PARAMETER}/cancellation`

// datovy-model.md 2, CAP-015-R35, CAP-015-R36
export const FILE_STATUS = {
	ANNOUNCED: "announced",
	RECEIVED: "received",
	REJECTED: "rejected",
	REMOVED: "removed",
} as const

// clinical-workflow.yaml AcquisitionFileAnnouncement
export const FILE_KIND = {
	IMAGE: "image",
	DOCUMENT_PAGE: "document_page",
} as const

// clinical-workflow.yaml ImageUpload, DocumentPageUpload, AcquisitionFileReplacement
export const PART = {
	IMAGE: "image",
	PAGE: "page",
	FILE: "file",
	THUMBNAIL: "thumbnail",
} as const

const ONE_PART = 1

// konfigurace-a-profily.md 2.7, CAP-015-R13
export const MULTIPART_COUNT_LIMITS = {
	files: 2,
	fields: 8,
	parts: 10,
} as const

// RFC 9110 Content-Length
export const CONTENT_LENGTH_HEADER = "content-length"

export const IMAGE_PARTS = [
	{ name: PART.IMAGE, maxCount: ONE_PART },
	{ name: PART.THUMBNAIL, maxCount: ONE_PART },
]
export const PAGE_PARTS = [
	{ name: PART.PAGE, maxCount: ONE_PART },
	{ name: PART.THUMBNAIL, maxCount: ONE_PART },
]
export const REPLACEMENT_PARTS = [
	{ name: PART.FILE, maxCount: ONE_PART },
	{ name: PART.THUMBNAIL, maxCount: ONE_PART },
]
