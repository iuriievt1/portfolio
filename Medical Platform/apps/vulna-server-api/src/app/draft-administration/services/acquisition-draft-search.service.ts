import { CONFIGURATION_KEY } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AcquisitionFileRepository } from "../../acquisition/repositories/acquisition-file.repository"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { administratorActorOf } from "../../audit/utils/administrator-audit-event"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { pageLimit } from "../../infra/utils/page-limit"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { AcquisitionDraftPageInput } from "../dto/acquisition-draft-page.input.dto"
import { AdministeredDraftRepository } from "../repositories/administered-draft.repository"
import { OperatorPresenceRepository } from "../repositories/operator-presence.repository"
import type {
	AdministeredDraftRow,
	AdministeredDraftsPageView,
	AdministeredDraftView,
} from "../types/draft-administration.types"
import { administeredDraftViewOf } from "../utils/administered-draft-view"
import { isDiscardConsentAllowed } from "../utils/discard-consent"
import { draftsViewedEventOf } from "../utils/draft-administration-audit"

const NO_FILES = 0

// CAP-004-R14, CAP-004-R09, CAP-025-R03, administration.yaml searchAcquisitionDrafts
@Injectable()
export class AcquisitionDraftSearchService {
	constructor(
		private readonly database: DatabaseService,
		private readonly drafts: AdministeredDraftRepository,
		private readonly presences: OperatorPresenceRepository,
		private readonly files: AcquisitionFileRepository,
		private readonly patients: PatientLookupService,
		private readonly configuration: ConfigurationService,
		private readonly audit: AuditRepository,
	) {}

	async search(
		administrator: AdministrationSession,
		query: AcquisitionDraftPageInput,
		now: Date,
	): Promise<AdministeredDraftsPageView> {
		const limit = pageLimit(query.limit, await this.configuration.pageSize())
		const absenceSeconds = await this.configuration.integer(CONFIGURATION_KEY.DRAFT_DISCARD_CONSENT_ABSENCE_SECONDS)
		const page = await this.drafts.page({
			limit,
			cursor: query.cursor,
			operatorUserId: query.operator_user_id,
			notUpdatedSince: query.not_updated_since,
		})
		const items = await this.viewsOf(page.rows, absenceSeconds, now)
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.audit.append(
				tx,
				administratorActorOf(administrator)(draftsViewedEventOf(query.operator_user_id, items)),
			)
		})
		return { items, next_cursor: page.nextCursor }
	}

	private async viewsOf(
		rows: readonly AdministeredDraftRow[],
		absenceSeconds: number,
		now: Date,
	): Promise<AdministeredDraftView[]> {
		const patients = await this.patients.patientsById(rows.map((row) => row.patient_id))
		const presences = await this.presences.presenceOf(rows.map((row) => row.operator_user_id))
		const counts = await this.files.receivedCountsOf(
			this.database.sql,
			rows.map((row) => row.id),
		)
		const presenceOf = new Map(presences.map((presence) => [presence.user_id, presence]))
		const receivedOf = new Map(counts.map((count) => [count.acquisition_id, count.received]))
		return rows.map((row) => {
			const patient = patients.get(row.patient_id)
			const presence = presenceOf.get(row.operator_user_id)
			if (patient === undefined || presence === undefined) {
				throw new Error(`the draft ${row.id} lost its patient or its operator`)
			}
			return administeredDraftViewOf(row, {
				patient,
				presence,
				receivedFileCount: receivedOf.get(row.id) ?? NO_FILES,
				isDiscardConsentAllowed: isDiscardConsentAllowed(presence, absenceSeconds, now),
			})
		})
	}
}
