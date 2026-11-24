import { CODE_LIST, type CodeListCode, nameIn } from "@ansora/contracts"
import {
	bodySurfaceOf,
	type ClinicalAuthor,
	type ClinicalDocumentTitle,
	type ClinicalDraftAssessment,
	type ClinicalDraftDocument,
	type ClinicalDraftFinding,
	type ClinicalDraftWoundType,
	type ClinicalFoundedDocument,
	type ClinicalStudy,
	type ClinicalWithdrawnDocument,
	type ClinicalWoundTypeChange,
	findingSiteKeyOf,
} from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { CodeListRepository } from "../../code-list/repositories/code-list.repository"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { FHIR_RESOURCE_TYPE, LOCAL_KIND } from "../constants/clinical-record.constants"
import { DocumentationUnavailableException } from "../exceptions/documentation-unavailable.exception"
import { ClinicalActorRepository } from "../repositories/clinical-actor.repository"
import { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import type {
	ClosedEncounter,
	DraftAssessmentRecord,
	DraftDocumentRecord,
	DraftFindingRecord,
	DraftWoundTypeRecord,
	FoundedDocumentRecord,
	WithdrawnDocumentRecord,
	WoundTypeChangeRecord,
} from "../types/clinical-record.types"
import { documentSeriesOf } from "../utils/document-series"

// CAP-016-R17, CAP-017-R02, CAP-017-R03, ADR-050, ADR-054, datovy-model.md 13.2
@Injectable()
export class ClinicalContentService {
	private readonly logger = new Logger(ClinicalContentService.name)

	constructor(
		private readonly actors: ClinicalActorRepository,
		private readonly links: FhirResourceLinkRepository,
		private readonly codeLists: CodeListRepository,
		private readonly configuration: ConfigurationService,
	) {}

	async findingOf(tx: postgres.TransactionSql, record: DraftFindingRecord): Promise<ClinicalDraftFinding> {
		return {
			findingId: record.findingId,
			acquisitionId: record.acquisitionId,
			patientResourceId: await this.patientResourceIdOf(tx, record.patientId, `finding ${record.findingId}`),
			department: await this.actors.departmentOf(tx, record.departmentId),
			site: { ...record.site, surface: bodySurfaceOf(record.site) },
		}
	}

	async woundTypeOf(tx: postgres.TransactionSql, record: DraftWoundTypeRecord): Promise<ClinicalDraftWoundType> {
		return {
			findingId: record.findingId,
			acquisitionId: record.acquisitionId,
			patientResourceId: await this.patientResourceIdOf(tx, record.patientId, `finding ${record.findingId}`),
			conditionResourceId: await this.resourceIdOf(
				tx,
				FHIR_RESOURCE_TYPE.CONDITION,
				LOCAL_KIND.FINDING,
				record.findingId,
			),
			department: await this.actors.departmentOf(tx, record.departmentId),
			woundTypeCode: record.woundTypeCode,
			woundTypeName: await this.itemNameOf(tx, CODE_LIST.WOUND_TYPE, record.woundTypeCode),
		}
	}

	// CAP-020-R21, ADR-049 (doplnění D32), ADR-050
	async woundTypeChangeOf(
		tx: postgres.TransactionSql,
		record: WoundTypeChangeRecord,
	): Promise<ClinicalWoundTypeChange> {
		return {
			changeId: record.changeId,
			findingId: record.findingId,
			patientId: record.patientId,
			patientResourceId: await this.patientResourceIdOf(tx, record.patientId, `finding ${record.findingId}`),
			conditionResourceId: await this.resourceIdOf(
				tx,
				FHIR_RESOURCE_TYPE.CONDITION,
				LOCAL_KIND.FINDING,
				record.findingId,
			),
			department: await this.actors.departmentOf(tx, record.departmentId),
			woundTypeCode: record.woundTypeCode,
			woundTypeName: await this.itemNameOf(tx, CODE_LIST.WOUND_TYPE, record.woundTypeCode),
			changedAt: record.changedAt.toISOString(),
			author: await this.authorAt(tx, record.changedBy, record.changedAt),
		}
	}

	async assessmentOf(tx: postgres.TransactionSql, record: DraftAssessmentRecord): Promise<ClinicalDraftAssessment> {
		return {
			acquisitionId: record.acquisitionId,
			patientResourceId: await this.patientResourceIdOf(tx, record.patientId, `finding ${record.findingId}`),
			conditionResourceId: await this.resourceIdOf(
				tx,
				FHIR_RESOURCE_TYPE.CONDITION,
				LOCAL_KIND.FINDING,
				record.findingId,
			),
			bodyStructureResourceId: await this.resourceIdOf(
				tx,
				FHIR_RESOURCE_TYPE.BODY_STRUCTURE,
				LOCAL_KIND.FINDING_SITE,
				findingSiteKeyOf(record.findingId, record.bodyDiagramVersion),
			),
			department: await this.actors.departmentOf(tx, record.departmentId),
			healingPhaseCode: record.healingPhaseCode,
			healingPhaseName:
				record.healingPhaseCode === undefined
					? undefined
					: await this.itemNameOf(tx, CODE_LIST.HEALING_PHASE, record.healingPhaseCode),
			description: record.description ?? undefined,
		}
	}

	// CAP-021-R39, CAP-021-R28, ADR-050 (doplnění D33) bod 1
	async foundedDocumentOf(
		tx: postgres.TransactionSql,
		record: FoundedDocumentRecord,
	): Promise<ClinicalFoundedDocument> {
		return {
			...(await this.documentOf(tx, record)),
			patientResourceId: await this.patientResourceIdOf(tx, record.patientId, `document ${record.documentId}`),
			study: await this.studyOf(tx, record.encounter),
			series: documentSeriesOf(record.series),
		}
	}

	// ADR-050 (doplnění D33) bod 3, CAP-015-R17, CAP-014-R25
	async withdrawnDocumentOf(
		tx: postgres.TransactionSql,
		record: WithdrawnDocumentRecord,
	): Promise<ClinicalWithdrawnDocument> {
		return { ...(await this.documentOf(tx, record)), series: record.series }
	}

	// ADR-050, integrace-dicom.md 5.9
	async studyOf(tx: postgres.TransactionSql, encounter: ClosedEncounter): Promise<ClinicalStudy> {
		return {
			encounterId: encounter.id,
			encounterResourceId: await this.resourceIdOf(
				tx,
				FHIR_RESOURCE_TYPE.ENCOUNTER,
				LOCAL_KIND.ENCOUNTER,
				encounter.id,
			),
			studyInstanceUid: encounter.studyInstanceUid,
			started: encounter.startedAt?.toISOString(),
			department: await this.actors.departmentOf(tx, encounter.departmentId),
		}
	}

	// CAP-021-R38
	async authorAt(tx: postgres.TransactionSql, userId: string, moment: Date): Promise<ClinicalAuthor> {
		return { userId, department: await this.actors.departmentAt(tx, userId, moment) }
	}

	// CAP-018-R15, CAP-021-R39, datovy-model.md 13.1
	async documentTitleOf(
		tx: postgres.TransactionSql,
		titleCode: string | null,
		titleText: string | null,
	): Promise<ClinicalDocumentTitle> {
		if (titleCode === null) {
			return { code: undefined, text: titleText ?? undefined }
		}
		return { code: titleCode, text: await this.itemNameOf(tx, CODE_LIST.DOCUMENT_TITLE, titleCode) }
	}

	// datovy-model.md 13.1, CAP-021-R26
	async itemNameOf(tx: postgres.TransactionSql, codeListCode: CodeListCode, code: string): Promise<string | undefined> {
		const items = await this.codeLists.items(tx, codeListCode)
		const item = items.find((candidate) => candidate.code === code)
		if (item === undefined) {
			return undefined
		}
		return nameIn(item.names, await this.configuration.instanceDefaultLanguage())
	}

	async patientResourceIdOf(tx: postgres.TransactionSql, patientId: string, subject: string): Promise<string> {
		const id = await this.links.resourceIdOf(tx, {
			resourceType: FHIR_RESOURCE_TYPE.PATIENT,
			localKind: LOCAL_KIND.PATIENT,
			localId: patientId,
		})
		if (id === undefined) {
			this.logger.error(`The ${subject} has no patient in the clinical record`)
			throw new DocumentationUnavailableException()
		}
		return id
	}

	async resourceIdOf(
		tx: postgres.TransactionSql,
		resourceType: string,
		localKind: string,
		localId: string,
	): Promise<string> {
		const id = await this.links.resourceIdOf(tx, { resourceType, localKind, localId })
		if (id === undefined) {
			this.logger.error(`The clinical record holds no ${resourceType} for ${localKind} ${localId}`)
			throw new DocumentationUnavailableException()
		}
		return id
	}

	// CAP-021-R39
	private async documentOf(tx: postgres.TransactionSql, record: DraftDocumentRecord): Promise<ClinicalDraftDocument> {
		return {
			documentId: record.documentId,
			acquisitionId: record.acquisitionId,
			department: await this.actors.departmentOf(tx, record.departmentId),
		}
	}
}
