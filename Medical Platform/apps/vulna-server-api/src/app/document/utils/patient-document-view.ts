import type { HistoryScanRecord } from "@ansora/vulna-domain"
import { documentTitleViewOf, withHistoryScanTitle } from "../../acquisition/utils/document-title-view"
import type { EncounterView } from "../../encounter/types/encounter.types"
import type { RecordFileRow } from "../../image/types/image.types"
import { coverFileIdOf, isImageDataAvailable } from "../../image/utils/record-files"
import type { PatientDocumentItemView, PatientDocumentRow } from "../types/document.types"

// clinical-workflow.yaml PatientDocumentItem, CAP-020-R18, CAP-018-R15, CAP-021-R25
export function patientDocumentItemOf(
	row: PatientDocumentRow,
	pages: readonly RecordFileRow[],
	encounter: EncounterView,
): PatientDocumentItemView {
	const title = documentTitleViewOf(row)
	if (title === undefined) {
		throw new Error(`the closed document ${row.id} carries no title`)
	}
	return {
		acquisition_id: row.id,
		closed_at: row.closed_at.toISOString(),
		encounter,
		page_count: row.file_count,
		document_title: title,
		is_image_data_available: isImageDataAvailable(pages),
		cover_page_id: coverFileIdOf(pages),
	}
}

// ADR-054 bod 2, CAP-020-R03, CAP-020-R18
export function withHistoryScan(row: PatientDocumentRow, scan: HistoryScanRecord): PatientDocumentRow {
	return { ...withHistoryScanTitle(row, scan), closed_at: new Date(scan.closedAt), file_count: scan.pageCount }
}
