import type { JOB_OBJECT_KIND } from "@ansora/core-server"
import type { REMOVAL, STORED_RENDITION } from "../constants/retention.constants"

export type StoredRendition = (typeof STORED_RENDITION)[keyof typeof STORED_RENDITION]

export type RetainedFileKind =
	| typeof JOB_OBJECT_KIND.IMAGE
	| typeof JOB_OBJECT_KIND.DOCUMENT_PAGE
	| typeof JOB_OBJECT_KIND.DOCUMENT

// CAP-026-R18
export interface BufferCopyRow {
	binary_object_id: string
	rendition: StoredRendition
	file_kind: RetainedFileKind | null
	file_id: string | null
	artifact_id: string | null
	acquisition_id: string
	retention_anchor: Date
}

// CAP-026-R19, CAP-026-R20
export interface RetainedFileRow {
	binary_object_id: string
	clinical_record_binary_id: string
	rendition: StoredRendition
	file_kind: RetainedFileKind
	file_id: string
	acquisition_id: string
	retention_anchor: Date
}

// CAP-026-R01, CAP-026-R02, CAP-026-R20
export interface RetentionPeriods {
	originalDays: number
	thumbnailDays: number | undefined
	viewingCopyDays: number | undefined
}

export type Removal = (typeof REMOVAL)[keyof typeof REMOVAL]

export interface StoreRetentionRun {
	requestedCount: number
	removedCount: number
}
