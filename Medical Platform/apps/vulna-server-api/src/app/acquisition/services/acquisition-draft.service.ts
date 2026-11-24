import { randomUUID } from "node:crypto"
import { ENCOUNTER_ACTION, ERROR_CODE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, CONFIGURATION_KEY } from "@ansora/core-server"
import { ACQUISITION_STATE, calendarDayIn, INSTANCE_TIME_ZONE } from "@ansora/vulna-domain"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { isUniqueViolation } from "../../../libs/database/unique-violation"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { userAuditEventOf } from "../../audit/utils/user-audit-event"
import { ClinicalReadService } from "../../clinical-record/services/clinical-read.service"
import { EncounterRecordService } from "../../clinical-record/services/encounter-record.service"
import { ViewerService } from "../../clinical-record/services/viewer.service"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { NO_FILES } from "../../encounter/constants/encounter.constants"
import { RejectedEncounterAction } from "../../encounter/exceptions/rejected-encounter-action.exception"
import { EncounterRejectionService } from "../../encounter/services/encounter-rejection.service"
import { EncounterTargetService } from "../../encounter/services/encounter-target.service"
import { requestedEncounterIdOf } from "../../encounter/utils/encounter-identity"
import type { PageInput } from "../../infra/dto/page.input.dto"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { pageLimit } from "../../infra/utils/page-limit"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import { withPatientSubject } from "../../registry/utils/patient-view"
import { DRAFT_LIMIT_LOCK, RACE_RETRIES } from "../constants/acquisition.constants"
import type { AcquisitionDraftCreateInput } from "../dto/acquisition-draft-create.input.dto"
import { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import { AcquisitionFileRepository } from "../repositories/acquisition-file.repository"
import type {
	AcquisitionDraftsPageView,
	AcquisitionDraftView,
	AcquisitionRow,
	DraftCreation,
} from "../types/acquisition.types"
import { acquisitionDraftSummaryOf, acquisitionReceiptOf } from "../utils/acquisition-draft-view"
import { AcquisitionDraftViewService } from "./acquisition-draft-view.service"
import { OperatorVerificationService } from "./operator-verification.service"
import { ScanDocumentService } from "./scan-document.service"

// CAP-021-R29
function sameRequest(existing: AcquisitionRow, input: AcquisitionDraftCreateInput): boolean {
	return (
		existing.operator_user_id === input.operator.user_id &&
		existing.patient_id === input.patient_id &&
		existing.kind === input.kind &&
		existing.started_at.getTime() === new Date(input.started_at).getTime() &&
		existing.encounter_id === requestedEncounterIdOf(input)
	)
}

// CAP-015-R30, CAP-014-R06, CAP-014-R17, CAP-021-R29
@Injectable()
export class AcquisitionDraftService {
	constructor(
		private readonly database: DatabaseService,
		private readonly drafts: AcquisitionDraftRepository,
		private readonly targets: EncounterTargetService,
		private readonly operators: OperatorVerificationService,
		private readonly patients: PatientLookupService,
		private readonly viewers: ViewerService,
		private readonly records: EncounterRecordService,
		private readonly configuration: ConfigurationService,
		private readonly audit: AuditRepository,
		private readonly rejections: EncounterRejectionService,
		private readonly views: AcquisitionDraftViewService,
		private readonly files: AcquisitionFileRepository,
		private readonly scanDocuments: ScanDocumentService,
		private readonly reads: ClinicalReadService,
	) {}

	async create(
		current: CurrentSession,
		input: AcquisitionDraftCreateInput,
		idempotencyKey: string,
		now: Date,
		retries = RACE_RETRIES,
	): Promise<DraftCreation> {
		const replay = await this.replayOf(current, input, idempotencyKey)
		if (replay !== undefined) {
			return replay
		}
		await this.operators.verify(current, { userId: input.operator.user_id, sessionId: input.operator.session_id }, now)
		await this.verifyConfigurationVersion(input.configuration_version)
		const patient = await this.patients.patientOf(input.patient_id)
		const { departmentId } = await this.viewers.viewerOf(current)
		const limit = await this.configuration.integer(CONFIGURATION_KEY.MAX_DRAFT_ACQUISITIONS)
		const today = calendarDayIn(INSTANCE_TIME_ZONE, now)
		try {
			return await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
				await tx`SELECT pg_advisory_xact_lock(hashtext(${`${DRAFT_LIMIT_LOCK}:${current.session.userId}`})::bigint)`
				// CAP-015-R18, CAP-015-S14
				if ((await this.drafts.countOwnDrafts(tx, current.session.userId)) >= limit) {
					throw new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.DRAFT_LIMIT_REACHED)
				}
				const encounter = await this.targets.lockTarget(tx, input, {
					patientId: patient.patient.id,
					departmentId,
					action: ENCOUNTER_ACTION.CREATE_DRAFT,
					today,
					now,
				})
				const row = await this.drafts.insert(tx, {
					id: randomUUID(),
					idempotencyKey,
					patientId: patient.patient.id,
					encounterId: encounter.id,
					kind: input.kind,
					operatorUserId: current.session.userId,
					operatorSessionId: input.operator.session_id,
					departmentId,
					configurationVersionId: input.configuration_version,
					startedAt: new Date(input.started_at),
				})
				// ADR-054 bod 5
				await this.records.record(tx, encounter)
				await this.scanDocuments.open(tx, row)
				await this.audit.append(
					tx,
					userAuditEventOf(current, {
						eventType: AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_CREATED,
						objectId: row.id,
						outcome: AUDIT_OUTCOME.SUCCESS,
						details: withPatientSubject(patient, { encounter_id: encounter.id, acquisition_id: row.id }),
					}),
				)
				return { created: true, receipt: acquisitionReceiptOf(row) }
			})
		} catch (error) {
			if (error instanceof RejectedEncounterAction) {
				throw await this.rejections.problemOf(current, patient, error)
			}
			if (isUniqueViolation(error) && retries > 0) {
				return await this.create(current, input, idempotencyKey, now, retries - 1)
			}
			throw error
		}
	}

	// CAP-015-R29, CAP-015-R36
	async listOwn(current: CurrentSession, page: PageInput, now: Date): Promise<AcquisitionDraftsPageView> {
		const limit = pageLimit(page.limit, await this.configuration.pageSize())
		const reminderSeconds = await this.configuration.integer(CONFIGURATION_KEY.DRAFT_ACQUISITION_REMINDER_SECONDS)
		const { rows, nextCursor } = await this.drafts.listOwnDrafts(current.session.userId, page.cursor, limit)
		const patients = await this.patients.patientsById(rows.map((row) => row.patient_id))
		const fileCounts = await this.files.countsOf(
			this.database.sql,
			rows.map((row) => row.id),
			current.device.id,
		)
		const fileCountsById = new Map(fileCounts.map((count) => [count.acquisition_id, count]))
		const items = rows.flatMap((row) => {
			const patient = patients.get(row.patient_id)
			if (patient === undefined) {
				return []
			}
			const counts = fileCountsById.get(row.id)
			const files = { received: counts?.received ?? NO_FILES, rejected: counts?.rejected ?? NO_FILES }
			return [acquisitionDraftSummaryOf(row, patient, files, { now, reminderSeconds })]
		})
		return { items, next_cursor: nextCursor }
	}

	// CAP-015-R15, CAP-015-R17, CAP-014-R25, CAP-020-R17
	async getOwn(current: CurrentSession, acquisitionId: string, now: Date): Promise<AcquisitionDraftView> {
		const row = await this.drafts.findById(this.database.sql, acquisitionId)
		if (row === undefined) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
		}
		if (row.state !== ACQUISITION_STATE.DRAFT) {
			throw (await this.isClosedRecordVisible(current, row))
				? new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.ACQUISITION_CLOSED)
				: new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
		}
		const viewer = await this.viewers.viewerOf(current)
		if (row.operator_user_id !== viewer.userId) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
		}
		const patient = await this.patients.patientOf(row.patient_id)
		const today = calendarDayIn(INSTANCE_TIME_ZONE, now)
		return await this.views.viewOf(this.database.sql, row, patient, viewer, today, current.device.id)
	}

	// CAP-003-R01, CAP-020-R16
	private async isClosedRecordVisible(current: CurrentSession, row: AcquisitionRow): Promise<boolean> {
		if (row.operator_user_id === current.session.userId) {
			return true
		}
		return await this.reads.isClosedRecordVisible(current, { acquisitionId: row.id, kind: row.kind })
	}

	// CAP-021-R29, ADR-012
	private async replayOf(
		current: CurrentSession,
		input: AcquisitionDraftCreateInput,
		idempotencyKey: string,
	): Promise<DraftCreation | undefined> {
		const existing = await this.drafts.findByIdempotencyKey(this.database.sql, idempotencyKey)
		if (existing === undefined) {
			return undefined
		}
		if (existing.operator_user_id !== current.session.userId || !sameRequest(existing, input)) {
			throw new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.IDEMPOTENCY_CONFLICT)
		}
		return { created: false, receipt: acquisitionReceiptOf(existing) }
	}

	// CAP-012-R19, CAP-012-S13
	private async verifyConfigurationVersion(version: number): Promise<void> {
		if (!(await this.drafts.configurationVersionExists(this.database.sql, version))) {
			throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE.RECORD_REJECTED)
		}
	}
}
