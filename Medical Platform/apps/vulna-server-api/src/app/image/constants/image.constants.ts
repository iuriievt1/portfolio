import type { MobileContract } from "@ansora/contracts"

export type ImageRendition = MobileContract.components["headers"]["ImageRendition"]

export const THUMBNAIL_SEGMENT = "thumbnail"

// clinical-workflow.yaml getImage, getImageThumbnail
export const IMAGES_PATH = "images"
export const IMAGE_ID_PARAMETER = "imageId"
export const IMAGE_SUBPATH = `:${IMAGE_ID_PARAMETER}`
export const IMAGE_THUMBNAIL_SUBPATH = `:${IMAGE_ID_PARAMETER}/${THUMBNAIL_SEGMENT}`

// clinical-workflow.yaml getDocumentPage, getDocumentPageThumbnail
export const DOCUMENT_PAGES_PATH = "document-pages"
export const PAGE_ID_PARAMETER = "pageId"
export const PAGE_SUBPATH = `:${PAGE_ID_PARAMETER}`
export const PAGE_THUMBNAIL_SUBPATH = `:${PAGE_ID_PARAMETER}/${THUMBNAIL_SEGMENT}`

// index.yaml ImageRendition, CAP-020-R22
export const IMAGE_RENDITION = {
	ORIGINAL: "original",
	// CAP-020-R15, CAP-021-R40
	VIEWING_COPY: "viewing_copy",
} as const satisfies Record<string, ImageRendition>

export const RELEASED_ONE = 1
export const RELEASED_NONE = 0

// CAP-020-R09
export const FILE_PART = {
	ORIGINAL: "original",
	THUMBNAIL: "thumbnail",
} as const

// CAP-020-R10, CAP-020-R15, CAP-020-R22, CAP-015-R17
export const FILE_OUTCOME = {
	RELEASE: "release",
	NOT_FOUND: "not_found",
	GONE: "gone",
	// ADR-053 (doplnění 2026-09-24) bod 1
	LINK: "link",
	SOURCE_UNAVAILABLE: "source_unavailable",
} as const

// CAP-020-R22
export const RELEASED_FILE = {
	BYTES: "bytes",
	LINK: "link",
} as const

// ADR-053 (doplnění 2026-09-24) bod 1, clinical-workflow.yaml ImageDownloadLink.expires_at
export const IMAGE_LINK_VALIDITY_SECONDS = 300

// CAP-020-R02
export const CACHE_CONTROL_HEADER = "Cache-Control"
export const NO_STORE = "no-store"
