import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { FILE_STATUS } from "../constants/acquisition-file.constants"
import type { AcquisitionRow } from "../types/acquisition.types"
import type { AcquisitionFileRow, DocumentPageReceiptView, ImageReceiptView } from "../types/acquisition-file.types"
import { alreadyDecided, idempotencyConflict, rejected } from "./acquisition-problems"

// CAP-021-R29, CAP-015-R34, CAP-015-S57, CAP-019-S19, CAP-015-R36
function storedFileOf(existing: AcquisitionFileRow | undefined, sha256: string): AcquisitionFileRow | undefined {
	if (existing === undefined) {
		return undefined
	}
	switch (existing.status) {
		case FILE_STATUS.ANNOUNCED:
			return undefined
		case FILE_STATUS.REMOVED:
			throw alreadyDecided()
		case FILE_STATUS.REJECTED:
			throw rejected("the file was rejected; a new file replaces it in the record")
		case FILE_STATUS.RECEIVED:
			if (sha256 === existing.original_upload_sha256 || sha256 === existing.sha256) {
				return existing
			}
			throw idempotencyConflict()
		default:
			return existing.status satisfies never
	}
}

// CAP-021-R23, CAP-021-R29, CAP-019-R14, CAP-019-S18
export function storedUploadOf(
	record: AcquisitionRow,
	existing: AcquisitionFileRow | undefined,
	sha256: string,
): AcquisitionFileRow | undefined {
	const stored = storedFileOf(existing, sha256)
	if (stored === undefined && record.state !== ACQUISITION_STATE.DRAFT) {
		throw alreadyDecided()
	}
	return stored
}

// clinical-workflow.yaml ImageReceipt
export function imageReceiptOf(file: AcquisitionFileRow): ImageReceiptView {
	return { image_id: file.id, is_thumbnail_received: file.thumbnail_binary_object_id !== null }
}

// clinical-workflow.yaml DocumentPageReceipt
export function documentPageReceiptOf(file: AcquisitionFileRow): DocumentPageReceiptView {
	return { page_id: file.id, sequence: file.sequence }
}
