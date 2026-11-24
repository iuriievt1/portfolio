import { ACQUISITION_KIND, EMPTIED_BY, ENCOUNTER_ACTION, ERROR_CODE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { ACQUISITION_STATE, calendarDayIn, INSTANCE_TIME_ZONE } from "@ansora/vulna-domain"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { isUniqueViolation } from "../../../libs/database/unique-violation"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { sessionActorOf, userAuditEventOf } from "../../audit/utils/user-audit-event"
import { EncounterRecordService } from "../../clinical-record/services/encounter-record.service"
import { ViewerService } from "../../clinical-record/services/viewer.service"
import { RejectedEncounterAction } from "../../encounter/exceptions/rejected-encounter-action.exception"
import { EncounterRepository } from "../../encounter/repositories/encounter.repository"
import { EncounterEmptyingService } from "../../encounter/services/encounter-emptying.service"
import { EncounterRejectionService } from "../../encounter/services/encounter-rejection.service"
import { EncounterTargetService } from "../../encounter/services/encounter-target.service"
import { requestedEncounterIdOf } from "../../encounter/utils/encounter-identity"
import { DraftAssessmentService } from "../../finding/services/draft-assessment.service"
import { FindingLocationService } from "../../finding/services/finding-location.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import { withPatientSubject } from "../../registry/utils/patient-view"
import { RACE_RETRIES } from "../constants/acquisition.constants"
import type { AcquisitionAssignmentInput } from "../dto/acquisition-assignment.input.dto"
import { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import type { AcquisitionDraftView, AcquisitionRow } from "../types/acquisition.types"
import { assignmentChangeOf } from "../utils/assignment-audit"
import { AcquisitionDraftViewService } from "./acquisition-draft-view.service"
import { ScanDocumentService } from "./scan-document.service"

// CAP-021-R29
function isAssignedAlready(draft: AcquisitionRow, input: AcquisitionAssignmentInput): boolean {
	return (
		draft.patient_id === input.patient_id &&
		draft.encounter_id === requestedEncounterIdOf(input) &&
		draft.finding_id === (input.finding_id ?? null)
	)
}

function notFound(): ProblemException {
	return new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
}

// CAP-014-R07, CAP-014-R08, CAP-014-R25, CAP-014-R26, CAP-014-R29, CAP-021-R32
@Injectable()
export class AcquisitionAssignmentService {
	constructor(
		private readonly database: DatabaseService,
		private readonly drafts: AcquisitionDraftRepository,
		private readonly encounters: EncounterRepository,
		private readonly targets: EncounterTargetService,
		private readonly emptying: EncounterEmptyingService,
		private readonly rejections: EncounterRejectionService,
		private readonly records: EncounterRecordService,
		private readonly views: AcquisitionDraftViewService,
		private readonly viewers: ViewerService,
		private readonly patients: PatientLookupService,
		private readonly audit: AuditRepository,
		private readonly locations: FindingLocationService,
		private readonly assessments: DraftAssessmentService,
		private readonly scanDocuments: ScanDocumentService,
	) {}

	async assign(
		current: CurrentSession,
		acquisitionId: string,
		version: number,
		input: AcquisitionAssignmentInput,
		now: Date,
		retries = RACE_RETRIES,
	): Promise<AcquisitionDraftView> {
		const known = await this.drafts.findById(this.database.sql, acquisitionId)
		if (known === undefined || known.operator_user_id !== current.session.userId) {
			throw notFound()
		}
		const previousPatient = await this.patients.patientOf(known.patient_id)
		const newPatient = await this.patients.patientOf(input.patient_id)
		const viewer = await this.viewers.viewerOf(current)
		const today = calendarDayIn(INSTANCE_TIME_ZONE, now)
		try {
			return await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
				const locked = await this.encounters.lockByIds(tx, [
					...new Set([known.encounter_id, requestedEncounterIdOf(input)]),
				])
				const draft = await this.drafts.lockById(tx, acquisitionId)
				if (draft === undefined || draft.operator_user_id !== current.session.userId) {
					throw notFound()
				}
				if (draft.state !== ACQUISITION_STATE.DRAFT) {
					throw new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.ACQUISITION_CLOSED)
				}
				if (isAssignedAlready(draft, input)) {
					return await this.views.viewOf(tx, draft, newPatient, viewer, today, current.device.id)
				}
				const source = locked.find((encounter) => encounter.id === draft.encounter_id)
				if (draft.version !== version || source === undefined) {
					throw new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.ACQUISITION_VERSION_CONFLICT)
				}
				const target = await this.targets.lockTarget(tx, input, {
					patientId: input.patient_id,
					departmentId: draft.department_id ?? undefined,
					action: ENCOUNTER_ACTION.ASSIGN,
					today,
					now,
				})
				const findingId = await this.findingOf(tx, draft, input)
				if (findingId === null) {
					await this.assessments.withdraw(tx, draft)
				}
				const moved = await this.drafts.reassign(
					tx,
					draft.id,
					{ patientId: input.patient_id, encounterId: target.id, findingId },
					now,
				)
				// CAP-014-S46, CAP-014-S47, ADR-050 (doplnění D33) bod 3
				await this.locations.followAssignment(tx, draft, findingId)
				await this.scanDocuments.withdraw(tx, draft)
				const emptied = await this.emptying.emptyIfBare(tx, source, now)
				// ADR-054 bod 5
				await this.records.record(tx, target)
				if (emptied !== undefined) {
					await this.records.record(tx, emptied)
				}
				await this.scanDocuments.refound(tx, moved)
				await this.assessments.followFinding(tx, moved, findingId)
				await this.audit.append(
					tx,
					userAuditEventOf(current, {
						eventType: AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_ASSIGNMENT_CHANGED,
						objectId: moved.id,
						outcome: AUDIT_OUTCOME.SUCCESS,
						details: withPatientSubject(newPatient, {
							encounter_id: target.id,
							acquisition_id: moved.id,
							operator_user_id: moved.operator_user_id,
							assignment_change: assignmentChangeOf(previousPatient, newPatient, source.id, target.id),
						}),
					}),
				)
				if (emptied !== undefined) {
					await this.emptying.recordEmptied(tx, source, emptied, {
						actor: sessionActorOf(current),
						patient: previousPatient,
						emptiedBy: EMPTIED_BY.ASSIGNMENT_CHANGE,
					})
				}
				return await this.views.viewOf(tx, moved, newPatient, viewer, today, current.device.id)
			})
		} catch (error) {
			if (error instanceof RejectedEncounterAction) {
				throw await this.rejections.problemOf(current, newPatient, error)
			}
			if (isUniqueViolation(error) && retries > 0) {
				return await this.assign(current, acquisitionId, version, input, now, retries - 1)
			}
			throw error
		}
	}

	// CAP-014-R26, CAP-014-S44, CAP-014-S46, CAP-020-R04
	private async findingOf(
		tx: postgres.TransactionSql,
		draft: AcquisitionRow,
		input: AcquisitionAssignmentInput,
	): Promise<string | null> {
		const findingId = input.finding_id ?? null
		if (findingId === null) {
			return null
		}
		if (draft.kind === ACQUISITION_KIND.SCAN) {
			throw new ProblemException(HttpStatus.BAD_REQUEST, ERROR_CODE.RECORD_REJECTED)
		}
		const keepsOwnFinding = findingId === draft.finding_id && draft.patient_id === input.patient_id
		if (keepsOwnFinding) {
			return findingId
		}
		const tracked = await this.locations.trackedFinding(tx, findingId, input.patient_id, draft.department_id)
		return tracked.id
	}
}
