import { ACQUISITION_KIND, type AcquisitionKind } from "@ansora/contracts"
import { documentPageThumbnailUrl, imageThumbnailUrl } from "../../image/utils/image-url"
import { FILE_KIND, FILE_STATUS } from "../constants/acquisition-file.constants"
import type { AcquisitionDraftFileView, AcquisitionFileRow, FileKind } from "../types/acquisition-file.types"

// clinical-workflow.yaml AcquisitionFileAnnouncement
export function fileKindOf(kind: AcquisitionKind): FileKind {
	switch (kind) {
		case ACQUISITION_KIND.PHOTO:
			return FILE_KIND.IMAGE
		case ACQUISITION_KIND.SCAN:
			return FILE_KIND.DOCUMENT_PAGE
		default:
			return kind satisfies never
	}
}

function thumbnailUrlOf(kind: AcquisitionKind, file: AcquisitionFileRow): string | null {
	if (file.thumbnail_binary_object_id === null) {
		return null
	}
	switch (kind) {
		case ACQUISITION_KIND.PHOTO:
			return imageThumbnailUrl(file.id)
		case ACQUISITION_KIND.SCAN:
			return documentPageThumbnailUrl(file.id)
		default:
			return kind satisfies never
	}
}

function viewStatusOf(file: AcquisitionFileRow): AcquisitionDraftFileView["status"] {
	if (file.status === FILE_STATUS.REMOVED) {
		throw new Error(`the removed file ${file.id} is not part of the record`)
	}
	return file.status
}

// clinical-workflow.yaml AcquisitionDraftFile, CAP-015-R35, CAP-015-S51, CAP-019-R24
export function acquisitionDraftFileViewOf(
	kind: AcquisitionKind,
	file: AcquisitionFileRow,
	deviceId: string,
): AcquisitionDraftFileView {
	const status = viewStatusOf(file)
	return {
		file_key: file.file_key,
		sequence: file.sequence,
		status,
		pending_on_other_device: status === FILE_STATUS.ANNOUNCED && file.announced_by_device_id !== deviceId,
		received_at: file.received_at?.toISOString() ?? null,
		edit: file.edit_kind,
		thumbnail_url: thumbnailUrlOf(kind, file),
		image_id: kind === ACQUISITION_KIND.PHOTO ? file.id : null,
		page_id: kind === ACQUISITION_KIND.SCAN ? file.id : null,
	}
}
