import { findingSiteKeyOf } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { FHIR_RESOURCE_TYPE, LOCAL_KIND } from "../constants/clinical-record.constants"
import { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import type {
	DraftAssessmentRecord,
	DraftFindingRecord,
	DraftWoundTypeRecord,
	WithdrawnFindingRecord,
	WoundTypeChangeRecord,
} from "../types/clinical-record.types"
import { ClinicalContentService } from "./clinical-content.service"
import { ClinicalRecordStoreService } from "./clinical-record-store.service"

// CAP-016-R17, CAP-017-R02, CAP-017-R03, CAP-020-R13, CAP-020-R21, ADR-050 (doplnění D33), ADR-054 bod 3, ADR-054 bod 5
@Injectable()
export class FindingRecordService {
	constructor(
		private readonly stores: ClinicalRecordStoreService,
		private readonly content: ClinicalContentService,
		private readonly links: FhirResourceLinkRepository,
	) {}

	async recordDraft(tx: postgres.TransactionSql, record: DraftFindingRecord): Promise<void> {
		const subject = `finding ${record.findingId}`
		const store = await this.stores.requireStore(subject)
		const finding = await this.content.findingOf(tx, record)
		const ids = await this.stores.written(subject, () => store.recordDraftFinding(finding))
		await this.links.upsert(tx, [
			{
				resourceType: FHIR_RESOURCE_TYPE.CONDITION,
				localKind: LOCAL_KIND.FINDING,
				localId: record.findingId,
				resourceId: ids.condition,
			},
			{
				resourceType: FHIR_RESOURCE_TYPE.BODY_STRUCTURE,
				localKind: LOCAL_KIND.FINDING_SITE,
				localId: findingSiteKeyOf(record.findingId, record.site.bodyDiagramVersion),
				resourceId: ids.bodyStructure,
			},
		])
	}

	// ADR-050 (doplnění D33) bod 3, ADR-050 bod 10
	async withdrawDraft(tx: postgres.TransactionSql, record: WithdrawnFindingRecord): Promise<void> {
		const subject = `finding ${record.findingId}`
		const store = await this.stores.requireStore(subject)
		const finding = await this.content.findingOf(tx, record)
		const woundType =
			record.woundTypeCode === null
				? undefined
				: await this.content.woundTypeOf(tx, { ...record, woundTypeCode: record.woundTypeCode })
		await this.stores.written(subject, () => store.withdrawDraftFinding(finding, woundType))
		await this.links.remove(tx, LOCAL_KIND.FINDING, [record.findingId])
		await this.links.remove(tx, LOCAL_KIND.FINDING_SITE, [
			findingSiteKeyOf(record.findingId, record.site.bodyDiagramVersion),
		])
		if (woundType !== undefined) {
			await this.links.remove(tx, LOCAL_KIND.FINDING_WOUND_TYPE, [record.findingId])
		}
	}

	// CAP-017-R02, CAP-020-R19
	async recordWoundType(tx: postgres.TransactionSql, record: DraftWoundTypeRecord): Promise<void> {
		const subject = `finding ${record.findingId}`
		const store = await this.stores.requireStore(subject)
		const woundType = await this.content.woundTypeOf(tx, record)
		const id = await this.stores.written(subject, () => store.recordDraftWoundType(woundType))
		await this.links.upsert(tx, [
			{
				resourceType: FHIR_RESOURCE_TYPE.OBSERVATION,
				localKind: LOCAL_KIND.FINDING_WOUND_TYPE,
				localId: record.findingId,
				resourceId: id,
			},
		])
	}

	// CAP-020-R21, ADR-049 (doplnění D32), ADR-054 bod 3
	async recordWoundTypeChange(tx: postgres.TransactionSql, record: WoundTypeChangeRecord): Promise<void> {
		const subject = `finding ${record.findingId}`
		const store = await this.stores.requireStore(subject)
		const change = await this.content.woundTypeChangeOf(tx, record)
		const id = await this.stores.written(subject, () => store.recordWoundTypeChange(change))
		await this.links.upsert(tx, [
			{
				resourceType: FHIR_RESOURCE_TYPE.OBSERVATION,
				localKind: LOCAL_KIND.FINDING_WOUND_TYPE,
				localId: record.findingId,
				resourceId: id,
			},
		])
	}

	// CAP-017-R03, CAP-017-R04
	async recordAssessment(tx: postgres.TransactionSql, record: DraftAssessmentRecord): Promise<void> {
		const subject = `finding ${record.findingId}`
		const store = await this.stores.requireStore(subject)
		const assessment = await this.content.assessmentOf(tx, record)
		const id = await this.stores.written(subject, () => store.recordDraftAssessment(assessment))
		await this.links.upsert(tx, [
			{
				resourceType: FHIR_RESOURCE_TYPE.OBSERVATION,
				localKind: LOCAL_KIND.ASSESSMENT,
				localId: record.acquisitionId,
				resourceId: id,
			},
		])
	}

	// ADR-050 (doplnění D33) bod 3
	async withdrawAssessment(tx: postgres.TransactionSql, record: DraftAssessmentRecord): Promise<void> {
		const subject = `finding ${record.findingId}`
		const store = await this.stores.requireStore(subject)
		const assessment = await this.content.assessmentOf(tx, record)
		await this.stores.written(subject, () => store.withdrawDraftAssessment(assessment))
		await this.links.remove(tx, LOCAL_KIND.ASSESSMENT, [record.acquisitionId])
	}
}
