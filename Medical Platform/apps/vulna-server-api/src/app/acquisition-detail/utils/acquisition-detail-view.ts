import { ACQUISITION_KIND, ACQUISITION_STATE_VALUE, type AcquisitionKind } from "@ansora/contracts"
import { documentTitleViewOf } from "../../acquisition/utils/document-title-view"
import { closedWoundTypeOf } from "../../finding/utils/closed-wound-type"
import { recordAssessmentOf, recordBodySiteOf } from "../../finding/utils/record-content"
import { woundTypeVersionText } from "../../finding/utils/timeline-view"
import type { RecordFileRow } from "../../image/types/image.types"
import { documentPageThumbnailUrl, imageThumbnailUrl } from "../../image/utils/image-url"
import { isImageDataAvailable } from "../../image/utils/record-files"
import type {
	AcquisitionDetailFileView,
	AcquisitionDetailView,
	ClosedDetailRecord,
	DetailParts,
} from "../types/acquisition-detail.types"

// clinical-workflow.yaml AcquisitionDetailFile, CAP-020-R10, CAP-020-R17, CAP-021-R34
export function detailFileOf(kind: AcquisitionKind, file: RecordFileRow): AcquisitionDetailFileView {
	switch (kind) {
		case ACQUISITION_KIND.PHOTO:
			return {
				sequence: file.sequence,
				image_id: file.id,
				page_id: null,
				thumbnail_url: file.has_thumbnail ? imageThumbnailUrl(file.id) : null,
				edit: file.edit_kind,
			}
		case ACQUISITION_KIND.SCAN:
			return {
				sequence: file.sequence,
				image_id: null,
				page_id: file.id,
				thumbnail_url: file.has_thumbnail ? documentPageThumbnailUrl(file.id) : null,
				edit: file.edit_kind,
			}
		default:
			return kind satisfies never
	}
}

// clinical-workflow.yaml AcquisitionDetail, CAP-020-R17, CAP-020-R19, CAP-019-R28
export function acquisitionDetailOf(record: ClosedDetailRecord, parts: DetailParts): AcquisitionDetailView {
	const woundType = closedWoundTypeOf(record)
	const view: AcquisitionDetailView = {
		acquisition_id: record.id,
		kind: record.kind,
		state: ACQUISITION_STATE_VALUE.RECEIVED,
		patient: parts.patient,
		encounter: parts.encounter,
		closed_at: record.closed_at.toISOString(),
		finding_id: record.finding_id,
		wound_type_code: woundType.code,
		wound_type_code_list_version: woundTypeVersionText(woundType),
		is_image_data_available: isImageDataAvailable(parts.files),
		files: parts.files.map((file) => detailFileOf(record.kind, file)),
	}
	const bodySite = recordBodySiteOf(record)
	if (bodySite !== undefined) {
		view.body_site = bodySite
	}
	const assessment = recordAssessmentOf(record)
	if (assessment !== undefined) {
		view.assessment = assessment
	}
	const title = documentTitleViewOf(record)
	if (title !== undefined) {
		view.document_title = title
	}
	return view
}
