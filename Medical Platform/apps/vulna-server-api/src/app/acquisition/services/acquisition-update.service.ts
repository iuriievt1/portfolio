import { ACQUISITION_KIND, ERROR_CODE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, codeListSetVersionText } from "@ansora/core-server"
import { ACQUISITION_STATE, type BodySite, calendarDayIn, INSTANCE_TIME_ZONE } from "@ansora/vulna-domain"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { userAuditEventOf } from "../../audit/utils/user-audit-event"
import { ViewerService } from "../../clinical-record/services/viewer.service"
import { WoundTypeLockedError } from "../../finding/errors/wound-type-locked.error"
import { DraftAssessmentService } from "../../finding/services/draft-assessment.service"
import { FindingLocationService } from "../../finding/services/finding-location.service"
import { FindingWoundTypeService } from "../../finding/services/finding-wound-type.service"
import type { WoundTypeChoice } from "../../finding/types/finding.types"
import { bodySiteOfView } from "../../finding/utils/body-site-view"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { FoundPatient } from "../../registry/types/registry.types"
import { withPatientSubject } from "../../registry/utils/patient-view"
import type { AcquisitionDraftUpdateInput } from "../dto/acquisition-draft-update.input.dto"
import { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import { AcquisitionUpdateRequestRepository } from "../repositories/acquisition-update-request.repository"
import { DocumentRepository } from "../repositories/document.repository"
import type { AcquisitionDraftView, AcquisitionRow, CheckedContent, DraftUpdate } from "../types/acquisition.types"
import { requestFingerprintOf } from "../utils/request-fingerprint"
import { AcquisitionDraftViewService } from "./acquisition-draft-view.service"
import { DocumentTitleService } from "./document-title.service"

function touchesLocation(input: AcquisitionDraftUpdateInput): boolean {
	return input.finding_id !== undefined || input.finding_key !== undefined || input.body_site !== undefined
}

// CAP-017-R02, CAP-017-R03
function touchesFinding(input: AcquisitionDraftUpdateInput): boolean {
	return input.wound_type_code !== undefined || input.assessment !== undefined
}

// CAP-018-R14, CAP-021-R22
function touchesWound(input: AcquisitionDraftUpdateInput): boolean {
	return touchesLocation(input) || touchesFinding(input)
}

// CAP-016-R17, CAP-015-R31
function hasFindingAfter(draft: AcquisitionRow, input: AcquisitionDraftUpdateInput): boolean {
	if (input.finding_id === null) {
		return false
	}
	return touchesLocation(input) || draft.finding_id !== null
}

function siteOf(input: AcquisitionDraftUpdateInput): BodySite | undefined {
	return input.body_site === undefined ? undefined : bodySiteOfView(input.body_site)
}

function notFound(): ProblemException {
	return new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
}

function versionConflict(): ProblemException {
	return new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.ACQUISITION_VERSION_CONFLICT)
}

// CAP-017-R02, CAP-017-R03
function findingMissing(): ProblemException {
	return new ProblemException(
		HttpStatus.UNPROCESSABLE_ENTITY,
		ERROR_CODE.RECORD_REJECTED,
		"a wound type and a healing phase need the finding of the record",
	)
}

// CAP-015-R30, CAP-015-R31, CAP-016-R17, CAP-017-R02, CAP-017-R03, CAP-018-R15, CAP-021-R29, CAP-021-R32, CAP-025-R26
@Injectable()
export class AcquisitionUpdateService {
	constructor(
		private readonly database: DatabaseService,
		private readonly drafts: AcquisitionDraftRepository,
		private readonly requests: AcquisitionUpdateRequestRepository,
		private readonly locations: FindingLocationService,
		private readonly woundTypes: FindingWoundTypeService,
		private readonly assessments: DraftAssessmentService,
		private readonly views: AcquisitionDraftViewService,
		private readonly viewers: ViewerService,
		private readonly patients: PatientLookupService,
		private readonly audit: AuditRepository,
		private readonly titles: DocumentTitleService,
		private readonly documents: DocumentRepository,
	) {}

	async update(current: CurrentSession, update: DraftUpdate, now: Date): Promise<AcquisitionDraftView> {
		const known = await this.drafts.findById(this.database.sql, update.acquisitionId)
		if (known === undefined || known.operator_user_id !== current.session.userId) {
			throw notFound()
		}
		const patient = await this.patients.patientOf(known.patient_id)
		try {
			return await this.updateDraft(current, update, patient, now)
		} catch (error) {
			if (error instanceof WoundTypeLockedError) {
				await this.auditLockedWoundType(current, update, patient, error)
				throw new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.WOUND_TYPE_LOCKED)
			}
			throw error
		}
	}

	private async updateDraft(
		current: CurrentSession,
		update: DraftUpdate,
		patient: FoundPatient,
		now: Date,
	): Promise<AcquisitionDraftView> {
		const fingerprint = requestFingerprintOf(update.input)
		const viewer = await this.viewers.viewerOf(current)
		const today = calendarDayIn(INSTANCE_TIME_ZONE, now)
		return await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const draft = await this.lockedDraft(tx, current, update.acquisitionId)
			const repeated = await this.requests.findByKey(tx, draft.id, update.requestKey)
			if (repeated !== undefined && !repeated.body_sha256.equals(fingerprint)) {
				throw new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.IDEMPOTENCY_CONFLICT)
			}
			// CAP-021-S24
			if (repeated !== undefined && repeated.response !== null) {
				return repeated.response
			}
			if (draft.patient_id !== patient.patient.id) {
				throw versionConflict()
			}
			if (repeated !== undefined) {
				return await this.views.viewOf(tx, draft, patient, viewer, today, current.device.id)
			}
			const updated = await this.applied(tx, draft, update, current, now)
			const view = await this.views.viewOf(tx, updated, patient, viewer, today, current.device.id)
			await this.requests.insert(tx, {
				acquisitionId: draft.id,
				requestKey: update.requestKey,
				fingerprint,
				response: view,
			})
			await this.audit.append(
				tx,
				userAuditEventOf(current, {
					eventType: AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_UPDATED,
					objectId: updated.id,
					outcome: AUDIT_OUTCOME.SUCCESS,
					details: withPatientSubject(patient, {
						encounter_id: updated.encounter_id,
						acquisition_id: updated.id,
						operator_user_id: updated.operator_user_id,
					}),
				}),
			)
			return view
		})
	}

	private async lockedDraft(
		tx: postgres.TransactionSql,
		current: CurrentSession,
		acquisitionId: string,
	): Promise<AcquisitionRow> {
		const draft = await this.drafts.lockById(tx, acquisitionId)
		if (draft === undefined || draft.operator_user_id !== current.session.userId) {
			throw notFound()
		}
		if (draft.state !== ACQUISITION_STATE.DRAFT) {
			throw new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.ACQUISITION_CLOSED)
		}
		return draft
	}

	// CAP-021-R32, CAP-018-R14, ADR-054 bod 3
	private async applied(
		tx: postgres.TransactionSql,
		draft: AcquisitionRow,
		update: DraftUpdate,
		current: CurrentSession,
		now: Date,
	): Promise<AcquisitionRow> {
		if (draft.version !== update.version) {
			throw versionConflict()
		}
		if (touchesWound(update.input) && draft.kind !== ACQUISITION_KIND.PHOTO) {
			throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE.RECORD_REJECTED)
		}
		// CAP-018-R14, CAP-018-R15
		if (update.input.document_title !== undefined && draft.kind !== ACQUISITION_KIND.SCAN) {
			throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE.RECORD_REJECTED)
		}
		const checked = await this.checkedContent(tx, draft, update.input, current.session.userId)
		const title =
			update.input.document_title === undefined ? undefined : await this.titles.check(tx, update.input.document_title)
		const findingId = touchesLocation(update.input)
			? await this.relocate(tx, draft, update.input, current)
			: draft.finding_id
		await this.describe(tx, draft, findingId, checked, now)
		if (title !== undefined) {
			await this.documents.setTitle(tx, draft.id, title)
		}
		return await this.drafts.touch(tx, draft.id, findingId, now)
	}

	// CAP-017-R02, CAP-017-R03, CAP-017-R16
	private async checkedContent(
		tx: postgres.TransactionSql,
		draft: AcquisitionRow,
		input: AcquisitionDraftUpdateInput,
		userId: string,
	): Promise<CheckedContent> {
		if (touchesFinding(input) && !hasFindingAfter(draft, input)) {
			throw findingMissing()
		}
		const woundType = await this.checkedWoundType(tx, draft, input, userId)
		if (input.assessment === undefined) {
			return { woundType, assessment: undefined }
		}
		const assessment = await this.assessments.check(tx, {
			healingPhaseCode: input.assessment.healing_phase_code,
			codeListVersion: input.assessment.code_list_version,
			description: input.assessment.description,
		})
		return { woundType, assessment }
	}

	// CAP-017-R02, CAP-017-S14
	private async checkedWoundType(
		tx: postgres.TransactionSql,
		draft: AcquisitionRow,
		input: AcquisitionDraftUpdateInput,
		userId: string,
	): Promise<WoundTypeChoice | undefined> {
		if (input.wound_type_code === undefined || input.code_list_version === undefined) {
			return undefined
		}
		const existingFindingId = await this.existingFindingIdOf(tx, draft, input)
		return await this.woundTypes.check(tx, existingFindingId, {
			code: input.wound_type_code,
			codeListVersion: input.code_list_version,
			userId,
		})
	}

	// CAP-016-R17, CAP-020-R13
	private async existingFindingIdOf(
		tx: postgres.TransactionSql,
		draft: AcquisitionRow,
		input: AcquisitionDraftUpdateInput,
	): Promise<string | undefined> {
		if (typeof input.finding_id === "string") {
			const chosen = await this.locations.checkExisting(tx, draft, input.finding_id, siteOf(input))
			return chosen.finding.id
		}
		if (touchesLocation(input)) {
			return undefined
		}
		return draft.finding_id ?? undefined
	}

	// CAP-017-R02, CAP-017-R03, ADR-054 bod 3
	private async describe(
		tx: postgres.TransactionSql,
		draft: AcquisitionRow,
		findingId: string | null,
		checked: CheckedContent,
		now: Date,
	): Promise<void> {
		if (checked.woundType === undefined && checked.assessment === undefined) {
			return
		}
		if (findingId === null) {
			throw new Error(`the draft ${draft.id} lost its finding while it was updated`)
		}
		if (checked.woundType !== undefined) {
			await this.woundTypes.apply(tx, draft, findingId, checked.woundType)
		}
		if (checked.assessment !== undefined) {
			await this.assessments.apply(tx, draft, findingId, checked.assessment, now)
		}
	}

	// CAP-016-R14, CAP-016-R17, ADR-050 (doplnění D33) bod 3
	private async relocate(
		tx: postgres.TransactionSql,
		draft: AcquisitionRow,
		input: AcquisitionDraftUpdateInput,
		current: CurrentSession,
	): Promise<string | null> {
		if (input.finding_id === null) {
			await this.assessments.withdraw(tx, draft)
		}
		const findingId = await this.locationOf(tx, draft, input, current)
		if (input.assessment === undefined && findingId !== null) {
			await this.assessments.followFinding(tx, draft, findingId)
		}
		return findingId
	}

	// CAP-016-R17, CAP-015-R31
	private async locationOf(
		tx: postgres.TransactionSql,
		draft: AcquisitionRow,
		input: AcquisitionDraftUpdateInput,
		current: CurrentSession,
	): Promise<string | null> {
		const site = siteOf(input)
		if (input.finding_id === null) {
			return await this.locations.clear(tx, draft)
		}
		if (input.finding_id !== undefined) {
			return await this.locations.chooseExisting(tx, draft, input.finding_id, site)
		}
		if (input.finding_key !== undefined && site !== undefined) {
			return await this.locations.placeNew(tx, draft, input.finding_key, site, current.session.userId)
		}
		if (site !== undefined) {
			return await this.locations.moveNew(tx, draft, site)
		}
		return draft.finding_id
	}

	// CAP-025-R30, CAP-017-S14
	private async auditLockedWoundType(
		current: CurrentSession,
		update: DraftUpdate,
		patient: FoundPatient,
		locked: WoundTypeLockedError,
	): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.audit.append(
				tx,
				userAuditEventOf(current, {
					eventType: AUDIT_EVENT_TYPE.FINDING_WOUND_TYPE_CHANGED,
					objectId: locked.findingId,
					outcome: AUDIT_OUTCOME.REJECTED,
					details: withPatientSubject(patient, {
						acquisition_id: update.acquisitionId,
						reason: ERROR_CODE.WOUND_TYPE_LOCKED,
						wound_type_change: {
							finding_id: locked.findingId,
							previous_wound_type_code: locked.previousCode,
							wound_type_code: locked.requestedCode,
							code_list_version: codeListSetVersionText(locked.codeListVersion),
						},
					}),
				}),
			)
		})
	}
}
