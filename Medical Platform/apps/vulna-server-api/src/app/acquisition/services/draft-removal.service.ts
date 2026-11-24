import type { EmptiedBy } from "@ansora/contracts"
import type { AuditEventType, JsonObject } from "@ansora/core-server"
import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import type { AuditActor } from "../../audit/types/audit.types"
import { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import { EncounterRecordService } from "../../clinical-record/services/encounter-record.service"
import { EncounterEmptyingService } from "../../encounter/services/encounter-emptying.service"
import type { EncounterRow } from "../../encounter/types/encounter.types"
import { DraftAssessmentService } from "../../finding/services/draft-assessment.service"
import { FindingLocationService } from "../../finding/services/finding-location.service"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import { AcquisitionFileRepository } from "../repositories/acquisition-file.repository"
import { DecidedAcquisitionRepository } from "../repositories/decided-acquisition.repository"
import type { AcquisitionRow, DecisionReason } from "../types/acquisition.types"
import { draftEventOf } from "../utils/draft-audit"
import { ScanDocumentService } from "./scan-document.service"

export interface DraftDecision {
	reason: DecisionReason
	eventType: AuditEventType
	emptiedBy: EmptiedBy
	details: (discardedFileCount: number) => JsonObject
}

// CAP-015-R17, CAP-015-R37, CAP-014-R29, CAP-019-R14, CAP-025-R29, CAP-026-R16, ADR-050, ADR-054
@Injectable()
export class DraftRemovalService {
	private readonly logger = new Logger(DraftRemovalService.name)

	constructor(
		private readonly drafts: AcquisitionDraftRepository,
		private readonly decided: DecidedAcquisitionRepository,
		private readonly files: AcquisitionFileRepository,
		private readonly binaries: BinaryObjectService,
		private readonly assessments: DraftAssessmentService,
		private readonly locations: FindingLocationService,
		private readonly scanDocuments: ScanDocumentService,
		private readonly emptying: EncounterEmptyingService,
		private readonly records: EncounterRecordService,
		private readonly patients: PatientLookupService,
		private readonly audit: AuditRepository,
	) {}

	async removeWithin(
		tx: postgres.TransactionSql,
		actor: AuditActor,
		draft: AcquisitionRow,
		encounter: EncounterRow,
		decision: DraftDecision,
		now: Date,
	): Promise<string[]> {
		const patient = await this.patients.patientOf(draft.patient_id)
		const held = await this.files.listHeld(tx, draft.id, draft.kind)
		const binaryObjectIds = await this.files.binaryObjectIdsOf(tx, draft.id, draft.kind)
		await this.decided.record(tx, [draft], decision.reason)
		await this.assessments.withdraw(tx, draft)
		await this.locations.withdrawNew(tx, draft)
		await this.scanDocuments.withdraw(tx, draft)
		await this.drafts.deleteDrafts(tx, [draft.id])
		await this.binaries.removeAll(tx, binaryObjectIds)
		const emptied = await this.emptying.emptyIfBare(tx, encounter, now)
		if (emptied !== undefined) {
			await this.records.record(tx, emptied)
		}
		await this.audit.append(tx, actor(draftEventOf(patient, draft, decision.eventType, decision.details(held.length))))
		if (emptied !== undefined) {
			await this.emptying.recordEmptied(tx, encounter, emptied, { actor, patient, emptiedBy: decision.emptiedBy })
		}
		this.logger.log(`Removed draft acquisition ${draft.id} with ${held.length} files as ${decision.reason}`)
		return binaryObjectIds
	}
}
