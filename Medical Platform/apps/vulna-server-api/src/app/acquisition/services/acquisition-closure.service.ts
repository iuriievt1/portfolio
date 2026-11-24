import { ACQUISITION_KIND, AUDIT_EVENT_TYPE, ERROR_CODE } from "@ansora/contracts"
import { ACQUISITION_STATE, type ClinicalStation, type ClinicalSteps, missingStepsOf } from "@ansora/vulna-domain"
import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { ClosingDeviceRepository } from "../../clinical-record/repositories/closing-device.repository"
import { ClosureRecordService } from "../../clinical-record/services/closure-record.service"
import type { ClosedRecord } from "../../clinical-record/types/clinical-record.types"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { NO_FILES } from "../../encounter/constants/encounter.constants"
import { EncounterRepository } from "../../encounter/repositories/encounter.repository"
import { AssessmentRepository } from "../../finding/repositories/assessment.repository"
import { BodySiteRepository } from "../../finding/repositories/body-site.repository"
import { FindingRepository } from "../../finding/repositories/finding.repository"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import { FILE_STATUS } from "../constants/acquisition-file.constants"
import { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import { AcquisitionFileRepository } from "../repositories/acquisition-file.repository"
import { AssemblyTaskRepository } from "../repositories/assembly-task.repository"
import { DeliveryRepository } from "../repositories/delivery.repository"
import { DocumentRepository } from "../repositories/document.repository"
import { FileUploadTaskRepository } from "../repositories/file-upload-task.repository"
import { SeriesRepository } from "../repositories/series.repository"
import type { AcquisitionReceiptView, AcquisitionRow, DraftClosing, SeriesRow } from "../types/acquisition.types"
import type { AcquisitionFileRow, ClosingContent, ClosureRequest } from "../types/acquisition-file.types"
import { closedReceiptOf } from "../utils/acquisition-draft-view"
import { notFound, rejected, versionConflict } from "../utils/acquisition-problems"
import {
	closedEncounterOf,
	closedSeriesOf,
	progressOf,
	scanRecordOf,
	seriesOwnerOf,
	woundRecordOf,
} from "../utils/closing-content"
import { draftAuditEventOf } from "../utils/draft-audit"
import { DraftAccessService } from "./draft-access.service"
import { OperatorVerificationService } from "./operator-verification.service"

// CAP-021-R25, CAP-021-S18
function incomplete(unfinished: readonly AcquisitionFileRow[]): ProblemException {
	return new ProblemException(
		HttpStatus.UNPROCESSABLE_ENTITY,
		ERROR_CODE.ACQUISITION_INCOMPLETE,
		undefined,
		{},
		{
			missing_file_keys: unfinished.map((file) => file.file_key),
		},
	)
}

// CAP-021-R22, CAP-021-R25, CAP-015-S48, CAP-021-S10, CAP-021-S18, CAP-017-S16
function requireClosable(
	draft: AcquisitionRow,
	content: ClosingContent,
	held: readonly AcquisitionFileRow[],
	closure: ClosureRequest,
	steps: ClinicalSteps,
): void {
	const missingSteps = missingStepsOf(progressOf(draft, content, held.length), steps)
	if (missingSteps.length > 0) {
		throw new ProblemException(
			HttpStatus.UNPROCESSABLE_ENTITY,
			ERROR_CODE.RECORD_REJECTED,
			undefined,
			{},
			{
				missing_steps: missingSteps,
			},
		)
	}
	if (closure.fileCount !== held.length) {
		throw rejected(`file_count ${closure.fileCount} differs from the ${held.length} files the record holds`)
	}
	const unfinished = held.filter((file) => file.status !== FILE_STATUS.RECEIVED)
	if (unfinished.length > 0) {
		throw incomplete(unfinished)
	}
}

// CAP-014-R14, CAP-021-R11, CAP-021-R13, CAP-021-R22, CAP-021-R25, CAP-021-R27, CAP-021-R29, CAP-021-R32, CAP-021-R36, CAP-021-R40, CAP-025-R26
@Injectable()
export class AcquisitionClosureService {
	private readonly logger = new Logger(AcquisitionClosureService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly access: DraftAccessService,
		private readonly drafts: AcquisitionDraftRepository,
		private readonly files: AcquisitionFileRepository,
		private readonly documents: DocumentRepository,
		private readonly sites: BodySiteRepository,
		private readonly findings: FindingRepository,
		private readonly assessments: AssessmentRepository,
		private readonly encounters: EncounterRepository,
		private readonly series: SeriesRepository,
		private readonly deliveries: DeliveryRepository,
		private readonly assemblies: AssemblyTaskRepository,
		private readonly uploads: FileUploadTaskRepository,
		private readonly records: ClosureRecordService,
		private readonly devices: ClosingDeviceRepository,
		private readonly operators: OperatorVerificationService,
		private readonly patients: PatientLookupService,
		private readonly audit: AuditRepository,
		private readonly configuration: ConfigurationService,
	) {}

	async close(current: CurrentSession, closure: ClosureRequest, now: Date): Promise<AcquisitionReceiptView> {
		const known = await this.access.findOwn(this.database.sql, current, closure.acquisitionId)
		if (known === undefined) {
			throw notFound()
		}
		if (known.state !== ACQUISITION_STATE.DRAFT) {
			return closedReceiptOf(known)
		}
		await this.operators.verify(current, closure.operator, closure.completedAt)
		// CAP-021-S10
		if (closure.fileCount === undefined || closure.fileCount === NO_FILES) {
			throw rejected("the closure carries no file count")
		}
		if (known.version !== closure.version) {
			throw versionConflict()
		}
		const steps = await this.configuration.clinicalSteps()
		return await this.database.sql.begin(
			async (tx: postgres.TransactionSql) => await this.closed(tx, current, closure, steps, now),
		)
	}

	private async closed(
		tx: postgres.TransactionSql,
		current: CurrentSession,
		closure: ClosureRequest,
		steps: ClinicalSteps,
		now: Date,
	): Promise<AcquisitionReceiptView> {
		const draft = await this.access.lockOwn(tx, current, closure.acquisitionId)
		if (draft === undefined) {
			throw notFound()
		}
		if (draft.state !== ACQUISITION_STATE.DRAFT) {
			return closedReceiptOf(draft)
		}
		if (draft.version !== closure.version) {
			throw versionConflict()
		}
		const held = await this.files.listHeld(tx, draft.id, draft.kind)
		const content = await this.contentOf(tx, draft)
		requireClosable(draft, content, held, closure, steps)
		const patient = await this.patients.patientOf(draft.patient_id)
		const heldIds = held.map((file) => file.id)
		await this.files.renumber(tx, draft.kind, heldIds)
		const closing: DraftClosing = {
			closedAt: closure.completedAt,
			fileCount: held.length,
			closingSessionId: closure.operator.sessionId,
			closingDeviceId: current.device.id,
		}
		const closedRow = await this.drafts.close(tx, draft.id, closing, now)
		// ADR-050
		await this.series.lockEncounter(tx, closedRow.encounter_id)
		const series = await this.series.assign(tx, seriesOwnerOf(closedRow, content))
		await this.deliveries.createWaiting(tx, closedRow.id)
		await this.assemblies.enqueue(tx, closedRow.id)
		await this.uploads.enqueue(tx, closedRow.kind, heldIds)
		await this.recordClosure(tx, closedRow, closing, content, series)
		await this.audit.append(
			tx,
			draftAuditEventOf(current, patient, closedRow, AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_CLOSED, {
				file_count: held.length,
				closing_session_id: closure.operator.sessionId,
			}),
		)
		this.logger.log(`Closed acquisition ${draft.id} with ${held.length} files from device ${current.device.id}`)
		return closedReceiptOf(closedRow)
	}

	// CAP-021-R22, CAP-018-R15
	private async contentOf(tx: postgres.TransactionSql, draft: AcquisitionRow): Promise<ClosingContent> {
		return {
			finding: draft.finding_id === null ? undefined : await this.findings.findById(tx, draft.finding_id),
			site: await this.sites.findByAcquisition(tx, draft.id),
			assessment: await this.assessments.findByAcquisition(tx, draft.id),
			document: draft.kind === ACQUISITION_KIND.SCAN ? await this.documents.findByAcquisition(tx, draft.id) : undefined,
		}
	}

	// CAP-021-R27, CAP-021-R31, ADR-054
	private async recordClosure(
		tx: postgres.TransactionSql,
		closed: AcquisitionRow,
		closing: DraftClosing,
		content: ClosingContent,
		series: SeriesRow,
	): Promise<void> {
		const encounter = await this.encounters.findById(tx, closed.encounter_id)
		if (encounter === undefined) {
			throw new Error(`the closed record ${closed.id} points to the unknown encounter ${closed.encounter_id}`)
		}
		const record: ClosedRecord = {
			acquisitionId: closed.id,
			patientId: closed.patient_id,
			departmentId: closed.department_id,
			operatorUserId: closed.operator_user_id,
			station: await this.stationOf(tx, closing.closingDeviceId),
			startedAt: closed.started_at,
			closedAt: closing.closedAt,
			encounter: closedEncounterOf(encounter),
			series: closedSeriesOf(series),
		}
		switch (closed.kind) {
			case ACQUISITION_KIND.PHOTO:
				await this.records.recordWound(tx, woundRecordOf(record, content))
				return
			case ACQUISITION_KIND.SCAN:
				await this.records.recordScan(tx, scanRecordOf(record, content, closing.fileCount))
				return
			default:
				return closed.kind satisfies never
		}
	}

	// ADR-050, integrace-dicom.md 5.9
	private async stationOf(tx: postgres.TransactionSql, deviceId: string): Promise<ClinicalStation> {
		const station = await this.devices.stationOf(tx, deviceId)
		if (station === undefined) {
			throw new Error(`the device ${deviceId} the record was closed on is not registered`)
		}
		return station
	}
}
