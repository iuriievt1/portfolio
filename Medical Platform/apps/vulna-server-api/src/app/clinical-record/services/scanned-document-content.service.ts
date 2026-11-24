import {
	CLINICAL_CONTENT_TYPE,
	type ClinicalRecordStorePort,
	type ClinicalScannedDocumentPdf,
} from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { FHIR_RESOURCE_TYPE, LOCAL_KIND, READ_ONLY_SNAPSHOT } from "../constants/clinical-record.constants"
import { ClinicalActorRepository } from "../repositories/clinical-actor.repository"
import { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import { FileResourceRepository } from "../repositories/file-resource.repository"
import type { ResourceWrite, ScannedDocumentDraft, ScannedDocumentRow } from "../types/clinical-record.types"
import { deliveredDocumentOf } from "../utils/delivered-document"
import { detachingOf, isKept, keptOrArchivedOf } from "../utils/retained-rendition"
import { ClinicalContentService } from "./clinical-content.service"
import { ClinicalRenditionService } from "./clinical-rendition.service"

// CAP-021-R39, CAP-021-R36, backend.md 3.1 T7, datovy-model.md 13.1 vulna-scanned-document
@Injectable()
export class ScannedDocumentContentService {
	private readonly logger = new Logger(ScannedDocumentContentService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly files: FileResourceRepository,
		private readonly links: FhirResourceLinkRepository,
		private readonly actors: ClinicalActorRepository,
		private readonly content: ClinicalContentService,
		private readonly renditions: ClinicalRenditionService,
	) {}

	// CAP-021-R39, CAP-026-R20
	async contentOf(
		documentId: string,
		store: ClinicalRecordStorePort,
	): Promise<ResourceWrite<ClinicalScannedDocumentPdf> | undefined> {
		const draft = await this.database.sql.begin(READ_ONLY_SNAPSHOT, async (tx) => {
			const row = await this.files.scannedDocument(tx, documentId)
			if (row === undefined) {
				this.logger.error(`The document ${documentId} does not exist or has no series`)
				return undefined
			}
			return await this.draftOf(tx, row)
		})
		if (draft === undefined) {
			return undefined
		}
		const { pdf } = draft
		const resource = {
			...draft.document,
			pdf: isKept(pdf) ? await this.renditions.renditionOf(pdf, CLINICAL_CONTENT_TYPE.PDF, store) : pdf,
		}
		return { resource, detaching: draft.detaching }
	}

	// datovy-model.md 13.2, CAP-026-R20, ADR-050 bod 14
	async remember(documentId: string, resourceId: string, detaching: readonly string[]): Promise<void> {
		await this.database.sql.begin(async (tx) => {
			await this.links.upsert(tx, [
				{
					resourceType: FHIR_RESOURCE_TYPE.DOCUMENT_REFERENCE,
					localKind: LOCAL_KIND.DOCUMENT,
					localId: documentId,
					resourceId,
				},
			])
			await this.files.markDetached(tx, detaching)
		})
	}

	private async draftOf(
		tx: postgres.TransactionSql,
		row: ScannedDocumentRow,
	): Promise<ScannedDocumentDraft | undefined> {
		const pdf = keptOrArchivedOf(row.pdf, row.output_pdf_deleted_at, CLINICAL_CONTENT_TYPE.PDF, null)
		if (pdf === undefined || row.closed_at === null || row.page_count === null) {
			this.logger.error(`The document ${row.document_id} has no closed record with a confirmed PDF`)
			return undefined
		}
		const resourceIdOf = (resourceType: string, localKind: string, localId: string) =>
			this.links.resourceIdOf(tx, { resourceType, localKind, localId })
		const patientResourceId = await resourceIdOf(FHIR_RESOURCE_TYPE.PATIENT, LOCAL_KIND.PATIENT, row.patient_id)
		const encounterResourceId = await resourceIdOf(FHIR_RESOURCE_TYPE.ENCOUNTER, LOCAL_KIND.ENCOUNTER, row.encounter_id)
		const studyResourceId = await resourceIdOf(
			FHIR_RESOURCE_TYPE.IMAGING_STUDY,
			LOCAL_KIND.IMAGING_STUDY,
			row.encounter_id,
		)
		if (patientResourceId === undefined || encounterResourceId === undefined || studyResourceId === undefined) {
			this.logger.error(`The document ${row.document_id} has no patient, encounter or study in the clinical record`)
			return undefined
		}
		const document = {
			acquisitionId: row.acquisition_id,
			documentId: row.document_id,
			patientResourceId,
			department: await this.actors.departmentOf(tx, row.department_id),
			closedAt: row.closed_at.toISOString(),
			author: await this.content.authorAt(tx, row.operator_user_id, row.closed_at),
			title: await this.content.documentTitleOf(tx, row.title_code, row.title_text),
			pageCount: row.page_count,
			study: { encounterResourceId },
			series: { seriesInstanceUid: row.series_instance_uid },
			studyResourceId,
			delivered: deliveredDocumentOf(row),
		}
		return { document, pdf, detaching: detachingOf([row.pdf]) }
	}
}
