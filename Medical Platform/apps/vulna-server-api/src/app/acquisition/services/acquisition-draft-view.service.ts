import { ACQUISITION_KIND } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type { Executor } from "../../../libs/database/database.service"
import { EncounterRepository } from "../../encounter/repositories/encounter.repository"
import { encounterViewOf } from "../../encounter/utils/encounter-view"
import { AssessmentRepository } from "../../finding/repositories/assessment.repository"
import { BodySiteRepository } from "../../finding/repositories/body-site.repository"
import { FindingRepository } from "../../finding/repositories/finding.repository"
import { bodySiteViewOfRow } from "../../finding/utils/body-site-view"
import type { FoundPatient } from "../../registry/types/registry.types"
import { patientViewOf } from "../../registry/utils/patient-view"
import { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import { AcquisitionFileRepository } from "../repositories/acquisition-file.repository"
import { DocumentRepository } from "../repositories/document.repository"
import type { AcquisitionDraftView, AcquisitionRow, Viewer } from "../types/acquisition.types"
import type { DocumentTitleView } from "../types/acquisition-file.types"
import { acquisitionDraftViewOf } from "../utils/acquisition-draft-view"
import { acquisitionDraftFileViewOf } from "../utils/acquisition-file-view"
import { documentTitleViewOf } from "../utils/document-title-view"

// CAP-015-R15, CAP-015-R17, CAP-015-R35, CAP-018-R15, CAP-003-R01
@Injectable()
export class AcquisitionDraftViewService {
	constructor(
		private readonly drafts: AcquisitionDraftRepository,
		private readonly encounters: EncounterRepository,
		private readonly sites: BodySiteRepository,
		private readonly findings: FindingRepository,
		private readonly assessments: AssessmentRepository,
		private readonly files: AcquisitionFileRepository,
		private readonly documents: DocumentRepository,
	) {}

	async viewOf(
		sql: Executor,
		row: AcquisitionRow,
		patient: FoundPatient,
		viewer: Viewer,
		today: string,
		deviceId: string,
	): Promise<AcquisitionDraftView> {
		const encounter = await this.encounters.findById(sql, row.encounter_id)
		if (encounter === undefined) {
			throw new Error(`the draft ${row.id} points to the missing visit ${row.encounter_id}`)
		}
		// CAP-020-S27
		const closed = await this.drafts.closedInDepartment(sql, [encounter.id], viewer.departmentId)
		const [visible] = await this.drafts.visibleCounts(sql, [encounter.id], {
			userId: viewer.userId,
			closedAcquisitionIds: closed,
		})
		const site = await this.sites.findByAcquisition(sql, row.id)
		const finding = row.finding_id === null ? undefined : await this.findings.findById(sql, row.finding_id)
		const held = await this.files.listHeld(sql, row.id, row.kind)
		return acquisitionDraftViewOf(
			row,
			patientViewOf(patient),
			encounterViewOf(encounter, visible?.count ?? 0, today),
			{
				bodySite: site === undefined ? undefined : bodySiteViewOfRow(site),
				woundTypeCode: finding?.wound_type_code ?? null,
				assessment: await this.assessments.findByAcquisition(sql, row.id),
			},
			{
				files: held.map((file) => acquisitionDraftFileViewOf(row.kind, file, deviceId)),
				documentTitle: await this.documentTitleOf(sql, row),
			},
		)
	}

	// CAP-018-R15
	private async documentTitleOf(sql: Executor, row: AcquisitionRow): Promise<DocumentTitleView | undefined> {
		if (row.kind !== ACQUISITION_KIND.SCAN) {
			return undefined
		}
		return documentTitleViewOf(await this.documents.findByAcquisition(sql, row.id))
	}
}
