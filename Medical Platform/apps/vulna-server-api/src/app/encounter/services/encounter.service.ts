import { AUDIT_SEARCH_METHOD, ENCOUNTER_ACTION, ERROR_CODE, RELEASE_KIND } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, CONFIGURATION_KEY } from "@ansora/core-server"
import { calendarDayIn, ENCOUNTER_STATUS, INSTANCE_TIME_ZONE } from "@ansora/vulna-domain"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AcquisitionDraftRepository } from "../../acquisition/repositories/acquisition-draft.repository"
import { AcquisitionFileRepository } from "../../acquisition/repositories/acquisition-file.repository"
import type { AcquisitionRow, EncounterAcquisitionItemView, Viewer } from "../../acquisition/types/acquisition.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import type { UserAuditEvent } from "../../audit/types/audit.types"
import { userAuditEventOf } from "../../audit/utils/user-audit-event"
import { ClinicalReadService } from "../../clinical-record/services/clinical-read.service"
import { EncounterRecordService } from "../../clinical-record/services/encounter-record.service"
import { ViewerService } from "../../clinical-record/services/viewer.service"
import { readOrRecordNone } from "../../clinical-record/utils/read-or-record-none"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { RELEASED_NONE } from "../../image/constants/image.constants"
import { RecordReleaseService } from "../../image/services/record-release.service"
import type { ReleaseSubject } from "../../image/types/image.types"
import type { PageInput } from "../../infra/dto/page.input.dto"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { pageLimit } from "../../infra/utils/page-limit"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { FoundPatient } from "../../registry/types/registry.types"
import { patientViewOf, withPatientSubject } from "../../registry/utils/patient-view"
import { patientListEventOf } from "../../registry/utils/search-audit"
import type { PatientEncountersQuery, ScheduledEncountersQuery } from "../dto/encounter.input.dto"
import { RejectedEncounterAction } from "../exceptions/rejected-encounter-action.exception"
import { EncounterRepository } from "../repositories/encounter.repository"
import { RecordContentRepository } from "../repositories/record-content.repository"
import type {
	EncounterAcquisitionsPageView,
	EncounterListMethod,
	EncounterRow,
	EncountersPageView,
	EncounterView,
	ScheduledEncounterListView,
} from "../types/encounter.types"
import { encounterAcquisitionItemOf, encounterViewOf } from "../utils/encounter-view"
import { recordProgressOf } from "../utils/record-progress"
import { EncounterRejectionService } from "./encounter-rejection.service"
import { EncounterViewService } from "./encounter-view.service"

// CAP-014-R12, CAP-014-R16, CAP-014-R19, CAP-014-R20, CAP-014-R22, CAP-014-R24
@Injectable()
export class EncounterService {
	constructor(
		private readonly database: DatabaseService,
		private readonly encounters: EncounterRepository,
		private readonly drafts: AcquisitionDraftRepository,
		private readonly patients: PatientLookupService,
		private readonly viewers: ViewerService,
		private readonly records: EncounterRecordService,
		private readonly configuration: ConfigurationService,
		private readonly audit: AuditRepository,
		private readonly rejections: EncounterRejectionService,
		private readonly views: EncounterViewService,
		private readonly reads: ClinicalReadService,
		private readonly contents: RecordContentRepository,
		private readonly files: AcquisitionFileRepository,
		private readonly releases: RecordReleaseService,
	) {}

	// CAP-014-R19, CAP-014-R24, CAP-014-R27, CAP-025-R18
	async listForPatient(current: CurrentSession, query: PatientEncountersQuery, now: Date): Promise<EncountersPageView> {
		const patient = await this.patients.patientOf(query.patient_id)
		const limit = pageLimit(query.limit, await this.configuration.pageSize())
		const page =
			query.date === undefined
				? await this.encounters.listAllDays(patient.patient.id, query.cursor, limit)
				: await this.encounters.listOpenOnDay(patient.patient.id, query.date, query.cursor, limit)
		const items = await readOrRecordNone(
			() => this.views.viewsOf(current, page.rows, now),
			() => this.recordList(current, AUDIT_SEARCH_METHOD.PATIENT_ENCOUNTERS, [patient], RELEASED_NONE),
		)
		await this.recordList(current, AUDIT_SEARCH_METHOD.PATIENT_ENCOUNTERS, [patient], items.length)
		return { items, next_cursor: page.nextCursor }
	}

	// CAP-014-R16, CAP-014-S12, CAP-014-S14, CAP-014-S16
	async listScheduled(
		current: CurrentSession,
		query: ScheduledEncountersQuery,
		now: Date,
	): Promise<ScheduledEncounterListView> {
		const viewer = await this.viewers.viewerOf(current)
		const rows = await this.scheduledRows(viewer, query.date)
		const patients = await this.patients.patientsById(rows.map((row) => row.patient_id))
		const views = await readOrRecordNone(
			() => this.views.viewsOf(current, rows, now),
			() => this.recordList(current, AUDIT_SEARCH_METHOD.SCHEDULED_LIST, [], RELEASED_NONE),
		)
		const items = views.flatMap((encounter) => {
			const found = patients.get(encounter.patient_id)
			return found === undefined ? [] : [{ patient: found, encounter }]
		})
		await this.recordList(
			current,
			AUDIT_SEARCH_METHOD.SCHEDULED_LIST,
			items.map((item) => item.patient),
			items.length,
		)
		return { items: items.map((item) => ({ patient: patientViewOf(item.patient), encounter: item.encounter })) }
	}

	// CAP-014-R22, CAP-015-R17, CAP-025-R28, ADR-054 bod 2
	async listContent(
		current: CurrentSession,
		encounterId: string,
		page: PageInput,
		now: Date,
	): Promise<EncounterAcquisitionsPageView> {
		const encounter = await this.encounterOf(encounterId)
		// CAP-014-R29
		if (encounter.status === ENCOUNTER_STATUS.CANCELLED) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
		}
		const release: ReleaseSubject = {
			kind: RELEASE_KIND.ENCOUNTER_CONTENT,
			objectId: encounter.id,
			patient: await this.patients.patientOf(encounter.patient_id),
			encounterId: encounter.id,
			acquisitionId: undefined,
		}
		const content = await readOrRecordNone(
			() => this.contentOf(current, encounter, page, now),
			() => this.releases.record(current, { ...release, releasedItemCount: RELEASED_NONE }),
		)
		await this.releases.record(current, { ...release, releasedItemCount: content.items.length })
		return content
	}

	private async contentOf(
		current: CurrentSession,
		encounter: EncounterRow,
		page: PageInput,
		now: Date,
	): Promise<Required<EncounterAcquisitionsPageView>> {
		const visibility = await this.reads.recordVisibilityOf(current, [encounter.id])
		const limit = pageLimit(page.limit, await this.configuration.pageSize())
		const { rows, nextCursor } = await this.drafts.listVisibleInEncounter(encounter.id, visibility, page.cursor, limit)
		return {
			encounter: await this.views.viewWith(visibility, encounter, now),
			items: await this.itemsOf(current, rows),
			next_cursor: nextCursor,
		}
	}

	// CAP-014-R22, CAP-015-R35, CAP-015-R36, CAP-017-R16
	private async itemsOf(
		current: CurrentSession,
		rows: readonly AcquisitionRow[],
	): Promise<EncounterAcquisitionItemView[]> {
		const ids = rows.map((row) => row.id)
		const contents = await this.contents.contentOf(this.database.sql, ids)
		const counts = await this.files.countsOf(this.database.sql, ids, current.device.id)
		const contentOf = new Map(contents.map((content) => [content.acquisition_id, content]))
		const countsOf = new Map(counts.map((count) => [count.acquisition_id, count]))
		const steps = await this.configuration.clinicalSteps()
		return rows.map((row) =>
			encounterAcquisitionItemOf(row, recordProgressOf(contentOf.get(row.id), countsOf.get(row.id)), steps),
		)
	}

	// CAP-014-R20, CAP-014-R28, CAP-025-R27
	async complete(current: CurrentSession, encounterId: string, now: Date): Promise<EncounterView> {
		const patient = await this.patients.patientOf((await this.encounterOf(encounterId)).patient_id)
		// CAP-014-R19, CAP-020-R16
		const visibility = await this.reads.recordVisibilityOf(current, [encounterId])
		const today = calendarDayIn(INSTANCE_TIME_ZONE, now)
		try {
			return await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
				const locked = await this.encounters.lockById(tx, encounterId)
				if (locked === undefined) {
					throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
				}
				const closedRecordCount = await this.drafts.countClosedVisible(tx, locked.id, visibility.closedAcquisitionIds)
				if (locked.status === ENCOUNTER_STATUS.COMPLETED) {
					return encounterViewOf(locked, closedRecordCount, today)
				}
				await this.rejectIncomplete(tx, locked, closedRecordCount)
				const completed = await this.encounters.complete(tx, locked.id, current.session.userId, now)
				// ADR-054 bod 5
				await this.records.record(tx, completed)
				await this.audit.append(
					tx,
					userAuditEventOf(current, {
						eventType: AUDIT_EVENT_TYPE.ENCOUNTER_COMPLETED,
						objectId: completed.id,
						outcome: AUDIT_OUTCOME.COMPLETED,
						details: withPatientSubject(patient, {
							encounter_id: completed.id,
							encounter_completion: { previous_status: locked.status, closed_record_count: closedRecordCount },
						}),
					}),
				)
				return encounterViewOf(completed, closedRecordCount, today)
			})
		} catch (error) {
			if (error instanceof RejectedEncounterAction) {
				throw await this.rejections.problemOf(current, patient, error)
			}
			throw error
		}
	}

	// CAP-014-R20, CAP-014-R29, CAP-014-S30, CAP-014-S31, CAP-014-S34
	private async rejectIncomplete(
		tx: postgres.TransactionSql,
		encounter: EncounterRow,
		closedRecordCount: number,
	): Promise<void> {
		if (encounter.status === ENCOUNTER_STATUS.CANCELLED) {
			throw new RejectedEncounterAction(ERROR_CODE.ENCOUNTER_CANCELLED, encounter, ENCOUNTER_ACTION.COMPLETE)
		}
		if (await this.drafts.hasDraft(tx, encounter.id)) {
			throw new RejectedEncounterAction(ERROR_CODE.ENCOUNTER_HAS_DRAFT, encounter, ENCOUNTER_ACTION.COMPLETE)
		}
		if (closedRecordCount === 0) {
			throw new RejectedEncounterAction(
				ERROR_CODE.ENCOUNTER_WITHOUT_CLOSED_RECORD,
				encounter,
				ENCOUNTER_ACTION.COMPLETE,
			)
		}
	}

	private async encounterOf(encounterId: string): Promise<EncounterRow> {
		const encounter = await this.encounters.findById(this.database.sql, encounterId)
		if (encounter === undefined) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
		}
		return encounter
	}

	// CAP-014-R16, CAP-003-R01
	private async scheduledRows(viewer: Viewer, date: string): Promise<EncounterRow[]> {
		const enabled = (await this.configuration.value(CONFIGURATION_KEY.SCHEDULED_ENCOUNTERS_ENABLED)) === true
		if (!enabled || viewer.departmentId === undefined) {
			return []
		}
		const limit = await this.configuration.integer(CONFIGURATION_KEY.SCHEDULED_ENCOUNTERS_MAX_ITEMS)
		return await this.encounters.listScheduled(date, viewer.departmentId, limit)
	}

	// CAP-025-R18
	private async recordList(
		current: CurrentSession,
		method: EncounterListMethod,
		released: readonly FoundPatient[],
		releasedItemCount: number,
	): Promise<void> {
		await this.appendAudit(current, patientListEventOf(method, released, releasedItemCount))
	}

	private async appendAudit(current: CurrentSession, event: UserAuditEvent): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.audit.append(tx, userAuditEventOf(current, event))
		})
	}
}
