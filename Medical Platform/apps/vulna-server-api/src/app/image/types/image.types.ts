import type { MobileContract, ReleaseKind } from "@ansora/contracts"
import type { AcquisitionState } from "@ansora/vulna-domain"
import type { FileStatus } from "../../acquisition/types/acquisition-file.types"
import type { FoundPatient } from "../../registry/types/registry.types"
import type { FILE_OUTCOME, FILE_PART, ImageRendition, RELEASED_FILE } from "../constants/image.constants"

export type FilePart = (typeof FILE_PART)[keyof typeof FILE_PART]

// CAP-015-R17, CAP-020-R04
export interface RecordScope {
	state: AcquisitionState
	operator_user_id: string
	department_id: string | null
}

// datovy-model.md 2, datovy-model.md 4, CAP-020-R22
export interface StoredFileRow extends RecordScope {
	id: string
	acquisition_id: string
	patient_id: string
	encounter_id: string
	status: FileStatus
	binary_object_id: string | null
	buffer_deleted_at: Date | null
	clinical_record_binary_id: string | null
	thumbnail_binary_object_id: string | null
	thumbnail_buffer_deleted_at: Date | null
	thumbnail_clinical_record_binary_id: string | null
	// CAP-020-R15, CAP-021-R40
	viewing_copy_binary_object_id: string | null
	viewing_copy_buffer_deleted_at: Date | null
	viewing_copy_clinical_record_binary_id: string | null
}

// CAP-020-R15, CAP-020-R22
export type ReleasedRendition = ImageRendition | null

// CAP-020-R09, CAP-020-R10, CAP-020-R15, CAP-020-R22
export type FileOutcome =
	| {
			kind: typeof FILE_OUTCOME.RELEASE
			binaryObjectId: string
			clinicalRecordBinaryId: string | null
			rendition: ReleasedRendition
	  }
	| { kind: typeof FILE_OUTCOME.NOT_FOUND }
	| { kind: typeof FILE_OUTCOME.GONE }
	| { kind: typeof FILE_OUTCOME.LINK; clinicalRecordBinaryId: string; rendition: ReleasedRendition }
	| { kind: typeof FILE_OUTCOME.SOURCE_UNAVAILABLE }

// clinical-workflow.yaml ImageDownloadLink
export type ImageDownloadLinkView = MobileContract.components["schemas"]["ImageDownloadLink"]

// CAP-020-R22, ADR-053 (doplnění 2026-09-24) bod 1
export type ReleasedFile =
	| { kind: typeof RELEASED_FILE.BYTES; bytes: Buffer; rendition: ReleasedRendition }
	| { kind: typeof RELEASED_FILE.LINK; link: ImageDownloadLinkView }

// clinical-workflow.yaml getImage, getDocumentPage
export interface FileRequest {
	fileId: string
	part: FilePart
	releaseKind: ReleaseKind
}

// CAP-025-R28
export interface RecordRelease {
	kind: ReleaseKind | undefined
	objectId: string
	patient: FoundPatient | undefined
	encounterId: string | undefined
	acquisitionId: string | undefined
	releasedItemCount: number
}

export type ReleaseSubject = Omit<RecordRelease, "releasedItemCount">

// clinical-workflow.yaml TimelineItem.images, AcquisitionDetailFile
export interface RecordFileRow {
	id: string
	acquisition_id: string
	sequence: number
	edit_kind: FileEdit | null
	has_thumbnail: boolean
	is_available: boolean
	// CAP-020-R15, CAP-021-R40
	has_viewing_copy: boolean
}

// clinical-workflow.yaml AcquisitionDetailFile.edit
export type FileEdit = NonNullable<MobileContract.components["schemas"]["AcquisitionDetailFile"]["edit"]>
