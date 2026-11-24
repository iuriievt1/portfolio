import { CODE_LIST } from "@ansora/contracts"
import {
	bodyDiagramRegion,
	bodyDiagramRelease,
	type ClinicalClosure,
	type ClinicalCodedValue,
	type ClinicalFirstWoundRecord,
	type ClinicalScanClosure,
	type ClinicalSeries,
	type ClinicalWoundClosure,
	type ClosureResourceIds,
	type DicomRegionCode,
} from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { FHIR_RESOURCE_TYPE, LOCAL_KIND } from "../constants/clinical-record.constants"
import { ClinicalActorRepository } from "../repositories/clinical-actor.repository"
import { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import type {
	ClosedRecord,
	ClosedScanRecord,
	ClosedWoundRecord,
	FindingOwner,
	ResourceLink,
} from "../types/clinical-record.types"
import { documentSeriesOf } from "../utils/document-series"
import { ClinicalContentService } from "./clinical-content.service"
import { ClinicalRecordStoreService } from "./clinical-record-store.service"

// integrace-dicom.md 5.3, integrace-dicom.md 5.9
function bodyRegionOf(record: ClosedWoundRecord): DicomRegionCode | undefined {
	const release = bodyDiagramRelease(record.site.bodyDiagramVersion)
	return release === undefined ? undefined : bodyDiagramRegion(release, record.site.regionCode)?.dicomRegion
}

// CAP-016-R17, CAP-020-R13
function findingOwnerOf(record: ClosedWoundRecord): FindingOwner {
	return {
		findingId: record.findingId,
		acquisitionId: record.acquisitionId,
		patientId: record.patientId,
		departmentId: record.departmentId,
	}
}

// datovy-model.md 13.2
function closureLinksOf(record: ClosedRecord, ids: ClosureResourceIds): ResourceLink[] {
	return [
		{
			resourceType: FHIR_RESOURCE_TYPE.IMAGING_STUDY,
			localKind: LOCAL_KIND.IMAGING_STUDY,
			localId: record.encounter.id,
			resourceId: ids.imagingStudy,
		},
		{
			resourceType: FHIR_RESOURCE_TYPE.DEVICE,
			localKind: LOCAL_KIND.DEVICE,
			localId: record.station.deviceId,
			resourceId: ids.station,
		},
	]
}

// CAP-021-R27, CAP-021-R31, ADR-050, ADR-054
@Injectable()
export class ClosureRecordService {
	constructor(
		private readonly stores: ClinicalRecordStoreService,
		private readonly content: ClinicalContentService,
		private readonly actors: ClinicalActorRepository,
		private readonly links: FhirResourceLinkRepository,
	) {}

	// CAP-021-S21
	async recordWound(tx: postgres.TransactionSql, record: ClosedWoundRecord): Promise<void> {
		const subject = `record ${record.acquisitionId}`
		const store = await this.stores.requireStore(subject)
		const closure = await this.woundClosureOf(tx, record)
		const ids = await this.stores.written(subject, () => store.recordWoundClosure(closure))
		await this.links.upsert(tx, closureLinksOf(record, ids))
	}

	// CAP-021-S35
	async recordScan(tx: postgres.TransactionSql, record: ClosedScanRecord): Promise<void> {
		const subject = `record ${record.acquisitionId}`
		const store = await this.stores.requireStore(subject)
		const closure = await this.scanClosureOf(tx, record)
		const ids = await this.stores.written(subject, () => store.recordScanClosure(closure))
		await this.links.upsert(tx, [
			...closureLinksOf(record, ids),
			{
				resourceType: FHIR_RESOURCE_TYPE.DOCUMENT_REFERENCE,
				localKind: LOCAL_KIND.DOCUMENT,
				localId: record.documentId,
				resourceId: ids.document,
			},
		])
	}

	private async woundClosureOf(tx: postgres.TransactionSql, record: ClosedWoundRecord): Promise<ClinicalWoundClosure> {
		const series: ClinicalSeries = {
			seriesInstanceUid: record.series.seriesInstanceUid,
			number: record.series.number,
			bodyRegion: bodyRegionOf(record),
			laterality: record.site.laterality,
		}
		return {
			...(await this.closureOf(tx, record, series)),
			firstRecord: record.isFirstRecordOfFinding ? await this.firstRecordOf(tx, record) : undefined,
			assessment: await this.content.assessmentOf(tx, {
				...findingOwnerOf(record),
				bodyDiagramVersion: record.site.bodyDiagramVersion,
				healingPhaseCode: record.healingPhaseCode,
				description: record.description,
			}),
			closedWoundType: await this.closedWoundTypeOf(tx, record.woundTypeCode),
		}
	}

	// CAP-020-R21, CAP-017-R16, CHG-181
	private async closedWoundTypeOf(
		tx: postgres.TransactionSql,
		woundTypeCode: string | undefined,
	): Promise<ClinicalCodedValue | undefined> {
		if (woundTypeCode === undefined) {
			return undefined
		}
		return { code: woundTypeCode, name: await this.content.itemNameOf(tx, CODE_LIST.WOUND_TYPE, woundTypeCode) }
	}

	// ADR-050, CAP-017-R16
	private async firstRecordOf(
		tx: postgres.TransactionSql,
		record: ClosedWoundRecord,
	): Promise<ClinicalFirstWoundRecord> {
		const owner = findingOwnerOf(record)
		const { woundTypeCode } = record
		return {
			finding: await this.content.findingOf(tx, { ...owner, site: record.site }),
			woundType:
				woundTypeCode === undefined ? undefined : await this.content.woundTypeOf(tx, { ...owner, woundTypeCode }),
		}
	}

	private async scanClosureOf(tx: postgres.TransactionSql, record: ClosedScanRecord): Promise<ClinicalScanClosure> {
		return {
			...(await this.closureOf(tx, record, documentSeriesOf(record.series))),
			documentId: record.documentId,
			title: await this.content.documentTitleOf(tx, record.titleCode, record.titleText),
			pageCount: record.pageCount,
		}
	}

	// ADR-050, integrace-dicom.md 5.9
	private async closureOf(
		tx: postgres.TransactionSql,
		record: ClosedRecord,
		series: ClinicalSeries,
	): Promise<ClinicalClosure> {
		return {
			acquisitionId: record.acquisitionId,
			patientId: record.patientId,
			patientResourceId: await this.content.patientResourceIdOf(tx, record.patientId, `record ${record.acquisitionId}`),
			department: await this.actors.departmentOf(tx, record.departmentId),
			startedAt: record.startedAt.toISOString(),
			closedAt: record.closedAt.toISOString(),
			author: await this.content.authorAt(tx, record.operatorUserId, record.closedAt),
			station: record.station,
			study: await this.content.studyOf(tx, record.encounter),
			series,
		}
	}
}
