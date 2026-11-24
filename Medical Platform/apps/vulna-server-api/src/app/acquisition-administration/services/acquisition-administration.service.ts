import { ADMINISTRATION_ERROR_CODE, RELEASE_KIND } from "@ansora/contracts"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AcquisitionFileRepository } from "../../acquisition/repositories/acquisition-file.repository"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import type { UserAuditEvent } from "../../audit/types/audit.types"
import { administratorSessionActorOf } from "../../audit/utils/administrator-audit-event"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { RELEASED_NONE, RELEASED_ONE } from "../../image/constants/image.constants"
import { recordReleaseEventOf } from "../../image/utils/record-release-event"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { pageLimit } from "../../infra/utils/page-limit"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { FoundPatient } from "../../registry/types/registry.types"
import type { AcquisitionSearchInput } from "../dto/acquisition-search.input.dto"
import { AdministeredAcquisitionRepository } from "../repositories/administered-acquisition.repository"
import type {
	AdministeredAcquisitionRow,
	AdministeredAcquisitionsPageView,
	AdministeredAcquisitionView,
	ReleasedAcquisition,
} from "../types/acquisition-administration.types"
import { acquisitionsViewedEventOf } from "../utils/acquisition-administration-audit"
import { administeredAcquisitionViewOf, fileCountOf } from "../utils/administered-acquisition-view"

// CAP-004-R10, CAP-004-S02, CAP-025-R03, CAP-025-R28, administration.yaml searchAcquisitions,
// getAcquisitionForAdministration
@Injectable()
export class AcquisitionAdministrationService {
	constructor(
		private readonly database: DatabaseService,
		private readonly acquisitions: AdministeredAcquisitionRepository,
		private readonly files: AcquisitionFileRepository,
		private readonly patients: PatientLookupService,
		private readonly configuration: ConfigurationService,
		private readonly audit: AuditRepository,
	) {}

	async search(
		administrator: AdministrationSession,
		query: AcquisitionSearchInput,
	): Promise<AdministeredAcquisitionsPageView> {
		const page = await this.acquisitions.page({
			limit: pageLimit(query.limit, await this.configuration.pageSize()),
			cursor: query.cursor,
			state: query.state,
			patientIdentifier: query.patient_identifier,
			from: query.from,
			to: query.to,
		})
		const patients = await this.patients.patientsById(page.rows.map((row) => row.patient_id))
		const receivedCounts = await this.receivedCountsOf(page.rows)
		const released = page.rows.map((row): ReleasedAcquisition => ({ row, patient: patientOf(patients, row) }))
		const items = released.map(({ row, patient }) =>
			administeredAcquisitionViewOf(row, {
				patient,
				fileCount: fileCountOf(row, receivedCounts),
				instances: undefined,
			}),
		)
		await this.append(administrator, acquisitionsViewedEventOf(released.map(({ patient }) => patient)))
		return { items, next_cursor: page.nextCursor }
	}

	async detail(administrator: AdministrationSession, acquisitionId: string): Promise<AdministeredAcquisitionView> {
		const row = await this.acquisitions.findById(acquisitionId)
		if (row === undefined) {
			await this.recordDetailRelease(administrator, acquisitionId, undefined, RELEASED_NONE)
			throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
		}
		const patient = patientOf(await this.patients.patientsById([row.patient_id]), row)
		const view = administeredAcquisitionViewOf(row, {
			patient,
			fileCount: fileCountOf(row, await this.receivedCountsOf([row])),
			instances: await this.acquisitions.instancesOf(row.id),
		})
		await this.recordDetailRelease(administrator, acquisitionId, { row, patient }, RELEASED_ONE)
		return view
	}

	// administration.yaml AcquisitionDetail.file_count
	private async receivedCountsOf(rows: readonly AdministeredAcquisitionRow[]): Promise<Map<string, number>> {
		const draftIds = rows.filter((row) => row.state === ACQUISITION_STATE.DRAFT).map((row) => row.id)
		const counts = await this.files.receivedCountsOf(this.database.sql, draftIds)
		return new Map(counts.map((count) => [count.acquisition_id, count.received]))
	}

	// CAP-025-R28
	private async recordDetailRelease(
		administrator: AdministrationSession,
		acquisitionId: string,
		released: ReleasedAcquisition | undefined,
		releasedItemCount: number,
	): Promise<void> {
		await this.append(
			administrator,
			recordReleaseEventOf({
				kind: RELEASE_KIND.ACQUISITION_DETAIL,
				objectId: acquisitionId,
				patient: released?.patient,
				encounterId: released?.row.encounter_id,
				acquisitionId,
				releasedItemCount,
			}),
		)
	}

	private async append(administrator: AdministrationSession, event: UserAuditEvent): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.audit.append(tx, administratorSessionActorOf(administrator)(event))
		})
	}
}

function patientOf(patients: ReadonlyMap<string, FoundPatient>, row: AdministeredAcquisitionRow): FoundPatient {
	const patient = patients.get(row.patient_id)
	if (patient === undefined) {
		throw new Error(`the acquisition ${row.id} lost its patient ${row.patient_id}`)
	}
	return patient
}
