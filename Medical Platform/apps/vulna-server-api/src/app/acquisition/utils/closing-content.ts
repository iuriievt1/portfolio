import { ACQUISITION_KIND } from "@ansora/contracts"
import type { ClosedSeries, DraftProgress } from "@ansora/vulna-domain"
import type {
	ClosedEncounter,
	ClosedRecord,
	ClosedScanRecord,
	ClosedWoundRecord,
} from "../../clinical-record/types/clinical-record.types"
import type { EncounterRow } from "../../encounter/types/encounter.types"
import { bodySiteOfRow } from "../../finding/utils/body-site-view"
import type { AcquisitionRow, SeriesOwner, SeriesRow } from "../types/acquisition.types"
import type { ClosingContent } from "../types/acquisition-file.types"
import { documentTitleViewOf } from "./document-title-view"

export function requiredOf<T>(value: T | undefined | null, what: string, acquisitionId: string): T {
	if (value === undefined || value === null) {
		throw new Error(`the closed record ${acquisitionId} has no ${what}`)
	}
	return value
}

// CAP-021-R22, CAP-017-R02, CAP-020-R19, CAP-018-R15
export function progressOf(draft: AcquisitionRow, content: ClosingContent, heldFileCount: number): DraftProgress {
	const { finding } = content
	return {
		kind: draft.kind,
		fileCount: heldFileCount,
		hasFinding: finding !== undefined,
		hasBodySite: content.site !== undefined,
		hasWoundType: finding !== undefined && finding.wound_type_code !== null,
		hasHealingPhase: content.assessment !== undefined && content.assessment.healing_phase_code !== null,
		hasDocumentTitle: documentTitleViewOf(content.document) !== undefined,
	}
}

// datovy-model.md 3, CAP-021-R11
export function seriesOwnerOf(closed: AcquisitionRow, content: ClosingContent): SeriesOwner {
	switch (closed.kind) {
		case ACQUISITION_KIND.PHOTO:
			return {
				encounterId: closed.encounter_id,
				findingId: requiredOf(content.finding, "finding", closed.id).id,
				documentId: undefined,
			}
		case ACQUISITION_KIND.SCAN:
			return {
				encounterId: closed.encounter_id,
				findingId: undefined,
				documentId: requiredOf(content.document, "document", closed.id).id,
			}
		default:
			return closed.kind satisfies never
	}
}

// ADR-050, integrace-dicom.md 5.9
export function closedEncounterOf(encounter: EncounterRow): ClosedEncounter {
	return {
		id: encounter.id,
		studyInstanceUid: encounter.study_instance_uid,
		startedAt: encounter.started_at,
		departmentId: encounter.department_id,
	}
}

// datovy-model.md 3, CAP-021-R11
export function closedSeriesOf(series: SeriesRow): ClosedSeries {
	return { seriesInstanceUid: series.series_instance_uid, number: series.series_number }
}

// ADR-050, CAP-020-R21
export function woundRecordOf(record: ClosedRecord, content: ClosingContent): ClosedWoundRecord {
	const finding = requiredOf(content.finding, "finding", record.acquisitionId)
	const { assessment } = content
	return {
		...record,
		findingId: finding.id,
		isFirstRecordOfFinding: finding.origin_acquisition_id === record.acquisitionId,
		site: bodySiteOfRow(requiredOf(content.site, "body site", record.acquisitionId)),
		woundTypeCode: finding.wound_type_code ?? undefined,
		healingPhaseCode: assessment?.healing_phase_code ?? undefined,
		description: assessment?.description ?? null,
	}
}

// ADR-050, CAP-018-R15, CAP-021-R39
export function scanRecordOf(record: ClosedRecord, content: ClosingContent, pageCount: number): ClosedScanRecord {
	const document = requiredOf(content.document, "document", record.acquisitionId)
	return {
		...record,
		documentId: document.id,
		titleCode: document.title_code,
		titleText: document.title_text,
		pageCount,
	}
}
