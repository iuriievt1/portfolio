import { AUDIT_SEARCH_METHOD } from "@ansora/contracts"
import { CONFIGURATION_KEY } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { userAuditEventOf } from "../../audit/utils/user-audit-event"
import { ClinicalReadService } from "../../clinical-record/services/clinical-read.service"
import { readOrRecordNone } from "../../clinical-record/utils/read-or-record-none"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { FoundPatient } from "../../registry/types/registry.types"
import { patientListEventOf } from "../../registry/utils/search-audit"
import { RecentPatientRepository } from "../repositories/recent-patient.repository"
import type { LatestOwnRecordRow, RecentPatient, RecentPatientListView } from "../types/recent-patients.types"
import { recentPatientViewOf } from "../utils/recent-patient-view"

// clinical-workflow.yaml listRecentPatients, CAP-013-R19, CAP-021-R13, CAP-025-R18
@Injectable()
export class RecentPatientsService {
	constructor(
		private readonly database: DatabaseService,
		private readonly records: RecentPatientRepository,
		private readonly reads: ClinicalReadService,
		private readonly patients: PatientLookupService,
		private readonly configuration: ConfigurationService,
		private readonly audit: AuditRepository,
	) {}

	async list(current: CurrentSession): Promise<RecentPatientListView> {
		const limit = await this.configuration.integer(CONFIGURATION_KEY.RECENT_PATIENTS_MAX_ITEMS)
		const rows = await this.records.latestOwnRecordPerPatient(current.session.userId, limit)
		const visible = await readOrRecordNone(
			() => this.visibleOf(current, rows),
			() => this.recordList(current, []),
		)
		const patients = await this.patients.patientsById(visible.map((row) => row.patient_id))
		const recent = visible.flatMap((row): RecentPatient[] => {
			const patient = patients.get(row.patient_id)
			return patient === undefined ? [] : [{ patient, lastDocumentedAt: row.closed_at }]
		})
		await this.recordList(
			current,
			recent.map((item) => item.patient),
		)
		return { items: recent.map(recentPatientViewOf) }
	}

	// CAP-003-R01, CAP-020-R16, ADR-053 bod 11
	private async visibleOf(current: CurrentSession, rows: readonly LatestOwnRecordRow[]): Promise<LatestOwnRecordRow[]> {
		if (rows.length === 0) {
			return []
		}
		const encounterIds = [...new Set(rows.map((row) => row.encounter_id))]
		const visibility = await this.reads.recordVisibilityOf(current, encounterIds)
		const visibleIds = new Set(visibility.closedAcquisitionIds)
		return rows.filter((row) => visibleIds.has(row.acquisition_id))
	}

	// CAP-025-R18
	private async recordList(current: CurrentSession, released: readonly FoundPatient[]): Promise<void> {
		const event = patientListEventOf(AUDIT_SEARCH_METHOD.RECENT_PATIENTS, released, released.length)
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.audit.append(tx, userAuditEventOf(current, event))
		})
	}
}
