import { ACQUISITION_KIND } from "@ansora/contracts"
import { ACQUISITION_STATE, type HistoryRecords } from "@ansora/vulna-domain"
import { withHistoryScanTitle } from "../../acquisition/utils/document-title-view"
import { withHistoryWound } from "../../finding/utils/record-content"
import type { ClosedDetailRecord, DetailRecordRow } from "../types/acquisition-detail.types"

// CAP-020-R17, CAP-015-R17
export function closedRecordOf(record: DetailRecordRow | undefined): ClosedDetailRecord | undefined {
	if (record === undefined || record.state === ACQUISITION_STATE.DRAFT || record.closed_at === null) {
		return undefined
	}
	return { ...record, closed_at: record.closed_at }
}

// ADR-054 bod 2, CAP-020-R03, CAP-020-R16, CAP-020-S14
export function visibleRecordOf(record: ClosedDetailRecord, history: HistoryRecords): ClosedDetailRecord | undefined {
	switch (record.kind) {
		case ACQUISITION_KIND.PHOTO: {
			const wound = history.wounds.find((candidate) => candidate.acquisitionId === record.id)
			return wound === undefined
				? undefined
				: { ...withHistoryWound(record, wound), finding_id: wound.findingId ?? null }
		}
		case ACQUISITION_KIND.SCAN: {
			const scan = history.scans.find((candidate) => candidate.acquisitionId === record.id)
			return scan === undefined
				? undefined
				: { ...withHistoryScanTitle(record, scan), closed_at: new Date(scan.closedAt) }
		}
		default:
			return record.kind satisfies never
	}
}
