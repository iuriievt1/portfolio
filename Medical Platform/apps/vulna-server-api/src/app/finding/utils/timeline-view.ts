import { codeListSetVersionText } from "@ansora/core-server"
import type { RecordFileRow } from "../../image/types/image.types"
import { imageThumbnailUrl, imageUrl } from "../../image/utils/image-url"
import { isImageDataAvailable, isViewable } from "../../image/utils/record-files"
import type {
	TimelineItemView,
	TimelineRecordRow,
	WoundTypeChangeRow,
	WoundTypeChangeView,
	WoundTypeValue,
} from "../types/finding-history.types"
import { closedWoundTypeOf } from "./closed-wound-type"
import { recordAssessmentOf, recordBodySiteOf } from "./record-content"

// clinical-workflow.yaml WoundTypeChange, CAP-020-R19
export function woundTypeChangeViewOf(row: WoundTypeChangeRow): WoundTypeChangeView {
	return {
		changed_at: row.changed_at.toISOString(),
		previous_wound_type_code: row.previous_wound_type_code,
		wound_type_code: row.wound_type_code,
	}
}

export function woundTypeVersionText(value: WoundTypeValue): string | null {
	return value.codeListVersion === null ? null : codeListSetVersionText(value.codeListVersion)
}

// clinical-workflow.yaml TimelineItem, CAP-020-R09, CAP-020-R10, CAP-020-R19
export function timelineItemOf(row: TimelineRecordRow, files: readonly RecordFileRow[]): TimelineItemView {
	const thumbnailFile = files.find((file) => file.has_thumbnail)
	const item: TimelineItemView = {
		acquisition_id: row.id,
		time: row.closed_at.toISOString(),
		kind: row.kind,
		is_image_data_available: isImageDataAvailable(files),
		thumbnail_url: thumbnailFile === undefined ? null : imageThumbnailUrl(thumbnailFile.id),
		images: files.map((file) => ({ image_id: file.id, url: isViewable(file) ? imageUrl(file.id) : null })),
		wound_type_code: closedWoundTypeOf(row).code,
		study_instance_uid: row.study_instance_uid,
		accession_number: row.accession_number,
	}
	const bodySite = recordBodySiteOf(row)
	if (bodySite !== undefined) {
		item.body_site = bodySite
	}
	const assessment = recordAssessmentOf(row)
	if (assessment !== undefined) {
		item.assessment = assessment
	}
	return item
}
