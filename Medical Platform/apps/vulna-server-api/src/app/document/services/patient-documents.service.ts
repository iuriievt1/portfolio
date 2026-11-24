import { RELEASE_KIND } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { ClinicalReadService } from "../../clinical-record/services/clinical-read.service"
import { readOrRecordNone } from "../../clinical-record/utils/read-or-record-none"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { EncounterRepository } from "../../encounter/repositories/encounter.repository"
import { EncounterViewService } from "../../encounter/services/encounter-view.service"
import { RELEASED_NONE } from "../../image/constants/image.constants"
import { RecordFileRepository } from "../../image/repositories/record-file.repository"
import { RecordReleaseService } from "../../image/services/record-release.service"
import type { ReleaseSubject } from "../../image/types/image.types"
import { filesByRecord } from "../../image/utils/record-files"
import { pageLimit } from "../../infra/utils/page-limit"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { PatientDocumentsInput } from "../dto/patient-documents.input.dto"
import { PatientDocumentRepository } from "../repositories/patient-document.repository"
import type { PatientDocumentItemView, PatientDocumentsPageView } from "../types/document.types"
import { patientDocumentItemOf, withHistoryScan } from "../utils/patient-document-view"

// CAP-020-R18, CAP-020-R04, CAP-025-R28, CAP-020-S15, CAP-020-S16, ADR-054 bod 2
@Injectable()
export class PatientDocumentsService {
	constructor(
		private readonly database: DatabaseService,
		private readonly documents: PatientDocumentRepository,
		private readonly files: RecordFileRepository,
		private readonly encounters: EncounterRepository,
		private readonly encounterViews: EncounterViewService,
		private readonly reads: ClinicalReadService,
		private readonly patients: PatientLookupService,
		private readonly releases: RecordReleaseService,
		private readonly configuration: ConfigurationService,
	) {}

	async list(current: CurrentSession, input: PatientDocumentsInput, now: Date): Promise<PatientDocumentsPageView> {
		const release: ReleaseSubject = {
			kind: RELEASE_KIND.PATIENT_DOCUMENTS,
			objectId: input.patient_id,
			patient: await this.patients.findPatient(input.patient_id),
			encounterId: undefined,
			acquisitionId: undefined,
		}
		const page = await readOrRecordNone(
			() => this.pageOf(current, input, now),
			() => this.releases.record(current, { ...release, releasedItemCount: RELEASED_NONE }),
		)
		await this.releases.record(current, { ...release, releasedItemCount: page.items.length })
		return page
	}

	private async pageOf(
		current: CurrentSession,
		input: PatientDocumentsInput,
		now: Date,
	): Promise<Required<PatientDocumentsPageView>> {
		const sql = this.database.sql
		const scans = new Map(
			(await this.reads.closedScansOfPatient(current, input.patient_id)).map((scan) => [scan.acquisitionId, scan]),
		)
		const limit = pageLimit(input.limit, await this.configuration.pageSize())
		const page = await this.documents.listClosed(input.patient_id, [...scans.keys()], input.cursor, limit)
		const pages = filesByRecord(
			await this.files.pagesOf(
				sql,
				page.rows.map((row) => row.id),
			),
		)
		const encounterIds = [...new Set(page.rows.map((row) => row.encounter_id))]
		const encounters = await this.encounterViews.viewsOf(
			current,
			await this.encounters.findByIds(sql, encounterIds),
			now,
		)
		const encounterById = new Map(encounters.map((encounter) => [encounter.encounter_id, encounter]))
		const items = page.rows.map((row): PatientDocumentItemView => {
			const encounter = encounterById.get(row.encounter_id)
			if (encounter === undefined) {
				throw new Error(`the document ${row.id} points to the missing visit ${row.encounter_id}`)
			}
			const scan = scans.get(row.id)
			if (scan === undefined) {
				throw new Error(`the document ${row.id} is not among the visible documents`)
			}
			return patientDocumentItemOf(withHistoryScan(row, scan), pages.get(row.id) ?? [], encounter)
		})
		return { items, next_cursor: page.nextCursor }
	}
}
