import { AUDIT_SEARCH_METHOD } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { userAuditEventOf } from "../../audit/utils/user-audit-event"
import { ClinicalReadService } from "../../clinical-record/services/clinical-read.service"
import type { RecordVisibility } from "../../clinical-record/types/clinical-record.types"
import { readOrRecordNone } from "../../clinical-record/utils/read-or-record-none"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { FoundPatient } from "../../registry/types/registry.types"
import { patientListEventOf } from "../../registry/utils/search-audit"
import { EncounterRepository } from "../repositories/encounter.repository"
import { UnfinishedEncounterRepository } from "../repositories/unfinished-encounter.repository"
import type { UnfinishedEncounter, UnfinishedEncounterListView, UnfinishedEncounterRow } from "../types/encounter.types"
import { unfinishedEncounterViewOf } from "../utils/unfinished-encounter-view"
import { EncounterViewService } from "./encounter-view.service"

interface VisibleUnfinished {
	visibility: RecordVisibility
	rows: UnfinishedEncounterRow[]
}

// clinical-workflow.yaml listUnfinishedEncounters, CAP-014-R18, CAP-014-R20, CAP-025-R18
@Injectable()
export class UnfinishedEncounterService {
	constructor(
		private readonly database: DatabaseService,
		private readonly unfinished: UnfinishedEncounterRepository,
		private readonly encounters: EncounterRepository,
		private readonly views: EncounterViewService,
		private readonly reads: ClinicalReadService,
		private readonly patients: PatientLookupService,
		private readonly configuration: ConfigurationService,
		private readonly audit: AuditRepository,
	) {}

	async list(current: CurrentSession, now: Date): Promise<UnfinishedEncounterListView> {
		const { maxSize } = await this.configuration.pageSize()
		const rows = await this.unfinished.ownUnfinished(current.session.userId, maxSize)
		const visible = await readOrRecordNone(
			() => this.visibleOf(current, rows),
			() => this.recordList(current, []),
		)
		const items = await this.unfinishedOf(visible, now)
		await this.recordList(
			current,
			items.map((item) => item.patient),
		)
		return { items: items.map(unfinishedEncounterViewOf) }
	}

	// CAP-003-R01, CAP-020-R16, ADR-053 bod 11
	private async visibleOf(
		current: CurrentSession,
		rows: readonly UnfinishedEncounterRow[],
	): Promise<VisibleUnfinished> {
		if (rows.length === 0) {
			return { visibility: { userId: current.session.userId, closedAcquisitionIds: [] }, rows: [] }
		}
		const visibility = await this.reads.recordVisibilityOf(
			current,
			rows.map((row) => row.encounter_id),
		)
		const visibleIds = new Set(visibility.closedAcquisitionIds)
		return {
			visibility,
			rows: rows.filter((row) => row.acquisition_ids.some((acquisitionId) => visibleIds.has(acquisitionId))),
		}
	}

	private async unfinishedOf(visible: VisibleUnfinished, now: Date): Promise<UnfinishedEncounter[]> {
		const encounterRows = await this.encounters.findByIds(
			this.database.sql,
			visible.rows.map((row) => row.encounter_id),
		)
		const views = await this.views.viewsWith(visible.visibility, encounterRows, now)
		const patients = await this.patients.patientsById(encounterRows.map((encounter) => encounter.patient_id))
		const viewOf = new Map(views.map((view) => [view.encounter_id, view]))
		return visible.rows.flatMap((row): UnfinishedEncounter[] => {
			const encounter = viewOf.get(row.encounter_id)
			const patient = encounter === undefined ? undefined : patients.get(encounter.patient_id)
			return encounter === undefined || patient === undefined
				? []
				: [{ patient, encounter, lastDocumentedAt: row.last_documented_at }]
		})
	}

	// CAP-025-R18
	private async recordList(current: CurrentSession, released: readonly FoundPatient[]): Promise<void> {
		const event = patientListEventOf(AUDIT_SEARCH_METHOD.UNFINISHED_ENCOUNTERS, released, released.length)
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.audit.append(tx, userAuditEventOf(current, event))
		})
	}
}
