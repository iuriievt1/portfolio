import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { FHIR_RESOURCE_TYPE, LOCAL_KIND } from "../constants/clinical-record.constants"
import { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import type { FoundedDocumentRecord, WithdrawnDocumentRecord } from "../types/clinical-record.types"
import { ClinicalContentService } from "./clinical-content.service"
import { ClinicalRecordStoreService } from "./clinical-record-store.service"

// CAP-021-R39, ADR-050 (doplnění D33), ADR-054 bod 3, ADR-054 bod 5
@Injectable()
export class DocumentRecordService {
	constructor(
		private readonly stores: ClinicalRecordStoreService,
		private readonly content: ClinicalContentService,
		private readonly links: FhirResourceLinkRepository,
	) {}

	// CAP-021-R28
	async recordDraft(tx: postgres.TransactionSql, record: FoundedDocumentRecord): Promise<void> {
		const subject = `document ${record.documentId}`
		const store = await this.stores.requireStore(subject)
		const document = await this.content.foundedDocumentOf(tx, record)
		const ids = await this.stores.written(subject, () => store.recordDraftDocument(document))
		await this.links.upsert(tx, [
			{
				resourceType: FHIR_RESOURCE_TYPE.DOCUMENT_REFERENCE,
				localKind: LOCAL_KIND.DOCUMENT,
				localId: record.documentId,
				resourceId: ids.document,
			},
			{
				resourceType: FHIR_RESOURCE_TYPE.IMAGING_STUDY,
				localKind: LOCAL_KIND.IMAGING_STUDY,
				localId: record.encounter.id,
				resourceId: ids.imagingStudy,
			},
		])
	}

	// ADR-050 (doplnění D33) bod 3, ADR-052 bod 6
	async withdrawDraft(tx: postgres.TransactionSql, record: WithdrawnDocumentRecord): Promise<void> {
		const recorded = await this.links.resourceIdOf(tx, {
			resourceType: FHIR_RESOURCE_TYPE.DOCUMENT_REFERENCE,
			localKind: LOCAL_KIND.DOCUMENT,
			localId: record.documentId,
		})
		if (recorded === undefined) {
			return
		}
		const subject = `document ${record.documentId}`
		const store = await this.stores.requireStore(subject)
		const document = await this.content.withdrawnDocumentOf(tx, record)
		await this.stores.written(subject, () => store.withdrawDraftDocument(document))
		await this.links.remove(tx, LOCAL_KIND.DOCUMENT, [record.documentId])
	}
}
