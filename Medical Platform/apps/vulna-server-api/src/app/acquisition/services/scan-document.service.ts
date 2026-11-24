import { ACQUISITION_KIND } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DocumentRecordService } from "../../clinical-record/services/document-record.service"
import type { DraftDocumentRecord } from "../../clinical-record/types/clinical-record.types"
import { EncounterRepository } from "../../encounter/repositories/encounter.repository"
import { DocumentRepository } from "../repositories/document.repository"
import { SeriesRepository } from "../repositories/series.repository"
import type { AcquisitionRow } from "../types/acquisition.types"
import { closedEncounterOf, closedSeriesOf } from "../utils/closing-content"
import { documentIdOfDraft, documentIdOfMove, seriesIdOfDocument } from "../utils/document-identity"

function documentRecordOf(documentId: string, draft: AcquisitionRow): DraftDocumentRecord {
	return { documentId, acquisitionId: draft.id, departmentId: draft.department_id }
}

// CAP-021-R39, CAP-021-R28, ADR-050 (doplnění D33)
@Injectable()
export class ScanDocumentService {
	constructor(
		private readonly documents: DocumentRepository,
		private readonly series: SeriesRepository,
		private readonly encounters: EncounterRepository,
		private readonly records: DocumentRecordService,
	) {}

	async open(tx: postgres.TransactionSql, draft: AcquisitionRow): Promise<void> {
		if (draft.kind !== ACQUISITION_KIND.SCAN) {
			return
		}
		const documentId = documentIdOfDraft(draft.idempotency_key)
		await this.documents.insert(tx, documentId, draft.id)
		await this.found(tx, draft, documentId)
	}

	// ADR-050 (doplnění D33) bod 3, CAP-015-R17
	async withdraw(tx: postgres.TransactionSql, draft: AcquisitionRow): Promise<void> {
		if (draft.kind !== ACQUISITION_KIND.SCAN) {
			return
		}
		const document = await this.documents.findByAcquisition(tx, draft.id)
		if (document === undefined) {
			throw new Error(`the scan ${draft.id} has no document`)
		}
		const series = await this.series.findOfDocument(tx, document.id)
		if (series !== undefined) {
			await this.series.lockEncounter(tx, series.encounter_id)
		}
		await this.records.withdrawDraft(tx, {
			...documentRecordOf(document.id, draft),
			series:
				series === undefined
					? undefined
					: { encounterId: series.encounter_id, seriesInstanceUid: series.series_instance_uid },
		})
		await this.series.removeOfDocument(tx, document.id)
	}

	// CAP-014-R25, ADR-050 (doplnění D33) bod 3
	async refound(tx: postgres.TransactionSql, moved: AcquisitionRow): Promise<void> {
		if (moved.kind !== ACQUISITION_KIND.SCAN) {
			return
		}
		const documentId = documentIdOfMove(moved.idempotency_key, moved.encounter_id)
		await this.documents.rekey(tx, moved.id, documentId)
		await this.found(tx, moved, documentId)
	}

	// CAP-021-R39, CAP-021-R28, CAP-021-R11
	private async found(tx: postgres.TransactionSql, draft: AcquisitionRow, documentId: string): Promise<void> {
		const encounter = await this.encounters.findById(tx, draft.encounter_id)
		if (encounter === undefined) {
			throw new Error(`the scan ${draft.id} points to the unknown encounter ${draft.encounter_id}`)
		}
		await this.series.lockEncounter(tx, encounter.id)
		const series = await this.series.assign(
			tx,
			{ encounterId: encounter.id, documentId },
			seriesIdOfDocument(documentId),
		)
		await this.records.recordDraft(tx, {
			...documentRecordOf(documentId, draft),
			patientId: draft.patient_id,
			encounter: closedEncounterOf(encounter),
			series: closedSeriesOf(series),
		})
	}
}
