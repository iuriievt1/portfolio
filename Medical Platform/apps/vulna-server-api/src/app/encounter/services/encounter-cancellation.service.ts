import { EMPTIED_BY, ENCOUNTER_ACTION, ERROR_CODE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { ENCOUNTER_STATUS } from "@ansora/vulna-domain"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { DECISION_REASON } from "../../acquisition/constants/acquisition.constants"
import { AcquisitionDraftRepository } from "../../acquisition/repositories/acquisition-draft.repository"
import { AcquisitionFileRepository } from "../../acquisition/repositories/acquisition-file.repository"
import { DecidedAcquisitionRepository } from "../../acquisition/repositories/decided-acquisition.repository"
import { ScanDocumentService } from "../../acquisition/services/scan-document.service"
import type { AcquisitionRow } from "../../acquisition/types/acquisition.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { sessionActorOf, userAuditEventOf } from "../../audit/utils/user-audit-event"
import { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import { EncounterRecordService } from "../../clinical-record/services/encounter-record.service"
import { DraftAssessmentService } from "../../finding/services/draft-assessment.service"
import { FindingLocationService } from "../../finding/services/finding-location.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { FoundPatient } from "../../registry/types/registry.types"
import { withPatientSubject } from "../../registry/utils/patient-view"
import { RejectedEncounterAction } from "../exceptions/rejected-encounter-action.exception"
import { EncounterRepository } from "../repositories/encounter.repository"
import type { DiscardedDrafts, EncounterRow } from "../types/encounter.types"
import { EncounterEmptyingService } from "./encounter-emptying.service"
import { EncounterRejectionService } from "./encounter-rejection.service"

// Q-150, CAP-014-R29, CAP-015-R17, CAP-025-R26, CAP-025-R29
@Injectable()
export class EncounterCancellationService {
	constructor(
		private readonly database: DatabaseService,
		private readonly encounters: EncounterRepository,
		private readonly drafts: AcquisitionDraftRepository,
		private readonly decided: DecidedAcquisitionRepository,
		private readonly emptying: EncounterEmptyingService,
		private readonly records: EncounterRecordService,
		private readonly patients: PatientLookupService,
		private readonly rejections: EncounterRejectionService,
		private readonly audit: AuditRepository,
		private readonly locations: FindingLocationService,
		private readonly assessments: DraftAssessmentService,
		private readonly scanDocuments: ScanDocumentService,
		private readonly files: AcquisitionFileRepository,
		private readonly binaries: BinaryObjectService,
	) {}

	async cancel(current: CurrentSession, encounterId: string, now: Date): Promise<void> {
		const known = await this.encounters.findById(this.database.sql, encounterId)
		if (known === undefined) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
		}
		const patient = await this.patients.patientOf(known.patient_id)
		let releasedBytes: string[] = []
		try {
			await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
				const locked = await this.encounters.lockById(tx, encounterId)
				if (locked === undefined) {
					throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
				}
				if (locked.status === ENCOUNTER_STATUS.COMPLETED) {
					throw new RejectedEncounterAction(ERROR_CODE.ENCOUNTER_COMPLETED, locked, ENCOUNTER_ACTION.CANCEL)
				}
				if (locked.status !== ENCOUNTER_STATUS.IN_PROGRESS) {
					return
				}
				if (await this.drafts.hasClosed(tx, locked.id)) {
					throw new RejectedEncounterAction(ERROR_CODE.ENCOUNTER_HAS_CLOSED_RECORD, locked, ENCOUNTER_ACTION.CANCEL)
				}
				const { discarded, binaryObjectIds } = await this.discardDrafts(tx, locked)
				releasedBytes = binaryObjectIds
				const emptied = await this.emptying.emptyIfBare(tx, locked, now)
				if (emptied === undefined) {
					throw new Error(`the visit ${locked.id} kept a record after its cancellation`)
				}
				// ADR-054 bod 5
				await this.records.record(tx, emptied)
				await this.recordDiscarded(tx, locked, discarded, current, patient)
				await this.emptying.recordEmptied(tx, locked, emptied, {
					actor: sessionActorOf(current),
					patient,
					emptiedBy: EMPTIED_BY.ENCOUNTER_CANCELLATION,
				})
			})
		} catch (error) {
			if (error instanceof RejectedEncounterAction) {
				throw await this.rejections.problemOf(current, patient, error)
			}
			throw error
		}
		// CAP-026-R17
		await this.binaries.discardBytes(releasedBytes)
	}

	// CAP-015-R17, CAP-019-R14
	private async discardDrafts(tx: postgres.TransactionSql, encounter: EncounterRow): Promise<DiscardedDrafts> {
		const discarded = await this.drafts.lockDraftsInEncounter(tx, encounter.id)
		await this.decided.record(tx, discarded, DECISION_REASON.DISCARDED)
		const binaryObjectIds: string[] = []
		// ADR-050 (doplnění D33) bod 3
		for (const draft of discarded) {
			await this.assessments.withdraw(tx, draft)
			await this.locations.withdrawNew(tx, draft)
			await this.scanDocuments.withdraw(tx, draft)
			binaryObjectIds.push(...(await this.files.binaryObjectIdsOf(tx, draft.id, draft.kind)))
		}
		await this.drafts.deleteDrafts(
			tx,
			discarded.map((draft) => draft.id),
		)
		// CAP-026-R17
		await this.binaries.removeAll(tx, binaryObjectIds)
		return { discarded, binaryObjectIds }
	}

	// CAP-025-R26
	private async recordDiscarded(
		tx: postgres.TransactionSql,
		encounter: EncounterRow,
		discarded: readonly AcquisitionRow[],
		current: CurrentSession,
		patient: FoundPatient,
	): Promise<void> {
		for (const draft of discarded) {
			await this.audit.append(
				tx,
				userAuditEventOf(current, {
					eventType: AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_DISCARD,
					objectId: draft.id,
					outcome: AUDIT_OUTCOME.SUCCESS,
					details: withPatientSubject(patient, {
						encounter_id: encounter.id,
						acquisition_id: draft.id,
						operator_user_id: draft.operator_user_id,
					}),
				}),
			)
		}
	}
}
