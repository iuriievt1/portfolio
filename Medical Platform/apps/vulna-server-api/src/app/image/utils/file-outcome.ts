import { FILE_STATUS } from "../../acquisition/constants/acquisition-file.constants"
import type { Viewer } from "../../acquisition/types/acquisition.types"
import { FILE_OUTCOME, FILE_PART, IMAGE_RENDITION } from "../constants/image.constants"
import type { FileOutcome, FilePart, ReleasedRendition, StoredFileRow } from "../types/image.types"
import { isRecordVisibleTo } from "./record-scope"

const NOT_FOUND: FileOutcome = { kind: FILE_OUTCOME.NOT_FOUND }
const GONE: FileOutcome = { kind: FILE_OUTCOME.GONE }
const SOURCE_UNAVAILABLE: FileOutcome = { kind: FILE_OUTCOME.SOURCE_UNAVAILABLE }
const NO_RENDITION = null

// CAP-015-R17, CAP-015-S59, CAP-020-R10, CAP-020-R15, CAP-020-R22
export function fileOutcomeOf(file: StoredFileRow | undefined, viewer: Viewer, part: FilePart): FileOutcome {
	if (file === undefined || !isRecordVisibleTo(file, viewer) || file.status !== FILE_STATUS.RECEIVED) {
		return NOT_FOUND
	}
	switch (part) {
		case FILE_PART.ORIGINAL:
			return originalOutcomeOf(file)
		case FILE_PART.THUMBNAIL:
			return thumbnailOutcomeOf(file)
		default:
			return part satisfies never
	}
}

// CAP-020-R15, CAP-026-R01, CAP-026-R20, CAP-021-R40, datovy-model.md 4
function originalOutcomeOf(file: StoredFileRow): FileOutcome {
	if (file.binary_object_id !== null) {
		return storedOutcomeOf(
			file.binary_object_id,
			file.buffer_deleted_at,
			file.clinical_record_binary_id,
			IMAGE_RENDITION.ORIGINAL,
		)
	}
	if (file.viewing_copy_binary_object_id === null) {
		return GONE
	}
	return storedOutcomeOf(
		file.viewing_copy_binary_object_id,
		file.viewing_copy_buffer_deleted_at,
		file.viewing_copy_clinical_record_binary_id,
		IMAGE_RENDITION.VIEWING_COPY,
	)
}

// CAP-020-R10, CAP-026-R02
function thumbnailOutcomeOf(file: StoredFileRow): FileOutcome {
	if (file.thumbnail_binary_object_id === null) {
		return NOT_FOUND
	}
	return storedOutcomeOf(
		file.thumbnail_binary_object_id,
		file.thumbnail_buffer_deleted_at,
		file.thumbnail_clinical_record_binary_id,
		NO_RENDITION,
	)
}

// CAP-026-R18, CAP-020-R22, ADR-053 (doplnění 2026-09-24) bod 1, datovy-model.md 4
function storedOutcomeOf(
	binaryObjectId: string,
	bufferDeletedAt: Date | null,
	clinicalRecordBinaryId: string | null,
	rendition: ReleasedRendition,
): FileOutcome {
	if (bufferDeletedAt === null) {
		return { kind: FILE_OUTCOME.RELEASE, binaryObjectId, clinicalRecordBinaryId, rendition }
	}
	return clinicalRecordBinaryId === null
		? SOURCE_UNAVAILABLE
		: { kind: FILE_OUTCOME.LINK, clinicalRecordBinaryId, rendition }
}
