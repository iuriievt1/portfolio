import type { ClinicalDeliveredDocument } from "@ansora/vulna-domain"
import type { ScannedDocumentRow } from "../types/clinical-record.types"

// integrace-dicom.md 5.9, CAP-021-R28, backend.md 3 T4
export function deliveredDocumentOf(row: ScannedDocumentRow): ClinicalDeliveredDocument | undefined {
	if (row.delivered_sop_instance_uid === null) {
		return undefined
	}
	return {
		sopInstanceUid: row.delivered_sop_instance_uid,
		title: row.delivered_title ?? undefined,
		language: row.delivered_language ?? undefined,
		createdAt: row.delivered_created_at?.toISOString(),
	}
}
