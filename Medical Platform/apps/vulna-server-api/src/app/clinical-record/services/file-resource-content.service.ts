import { JOB_OBJECT_KIND } from "@ansora/core-server"
import {
	CLINICAL_CONTENT_TYPE,
	CLINICAL_FILE_KIND,
	type ClinicalFileResource,
	type ClinicalRecordStorePort,
} from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { FHIR_RESOURCE_TYPE, LOCAL_KIND, READ_ONLY_SNAPSHOT } from "../constants/clinical-record.constants"
import { ClinicalActorRepository } from "../repositories/clinical-actor.repository"
import { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import { FileResourceRepository } from "../repositories/file-resource.repository"
import type {
	ConfirmedRenditionRow,
	FileResourceBase,
	FileResourceDraft,
	FileResourceObjectKind,
	FileResourceRow,
	ResourceWrite,
} from "../types/clinical-record.types"
import { detachingOf, isKept, keptOf, keptOrArchivedOf } from "../utils/retained-rendition"
import { ClinicalRenditionService } from "./clinical-rendition.service"

const FILE_LOCAL_KIND = {
	[JOB_OBJECT_KIND.IMAGE]: LOCAL_KIND.IMAGE,
	[JOB_OBJECT_KIND.DOCUMENT_PAGE]: LOCAL_KIND.DOCUMENT_PAGE,
} as const satisfies Record<FileResourceObjectKind, string>

// CAP-021-R37, ADR-050 bod 13, datovy-model.md 13.2
@Injectable()
export class FileResourceContentService {
	private readonly logger = new Logger(FileResourceContentService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly files: FileResourceRepository,
		private readonly links: FhirResourceLinkRepository,
		private readonly actors: ClinicalActorRepository,
		private readonly renditions: ClinicalRenditionService,
	) {}

	// CAP-021-R37, CAP-026-R19, CAP-026-R20
	async contentOf(
		kind: FileResourceObjectKind,
		fileId: string,
		store: ClinicalRecordStorePort,
	): Promise<ResourceWrite<ClinicalFileResource> | undefined> {
		const draft = await this.database.sql.begin(READ_ONLY_SNAPSHOT, async (tx) => {
			const row = await this.files.find(tx, kind, fileId)
			if (row === undefined) {
				this.logger.error(`The ${kind} ${fileId} does not exist`)
				return undefined
			}
			return await this.draftOf(tx, kind, row)
		})
		if (draft === undefined) {
			return undefined
		}
		const { original, thumbnail, viewingCopy } = draft.renditions
		const jpegOf = (row: ConfirmedRenditionRow) => this.renditions.renditionOf(row, CLINICAL_CONTENT_TYPE.JPEG, store)
		const resource = draft.resourceWith({
			original: isKept(original) ? await jpegOf(original) : original,
			thumbnail: thumbnail === undefined ? undefined : await jpegOf(thumbnail),
			viewingCopy: viewingCopy === undefined ? undefined : await jpegOf(viewingCopy),
		})
		return { resource, detaching: draft.detaching }
	}

	// datovy-model.md 13.2, CAP-026-R19, ADR-050 bod 14
	async remember(
		kind: FileResourceObjectKind,
		fileId: string,
		resourceId: string,
		detaching: readonly string[],
	): Promise<void> {
		await this.database.sql.begin(async (tx) => {
			await this.links.upsert(tx, [
				{
					resourceType: FHIR_RESOURCE_TYPE.DOCUMENT_REFERENCE,
					localKind: FILE_LOCAL_KIND[kind],
					localId: fileId,
					resourceId,
				},
			])
			await this.files.markDetached(tx, detaching)
		})
	}

	private async draftOf(
		tx: postgres.TransactionSql,
		kind: FileResourceObjectKind,
		row: FileResourceRow,
	): Promise<FileResourceDraft | undefined> {
		const original = keptOrArchivedOf(
			row.original,
			row.original_deleted_at,
			CLINICAL_CONTENT_TYPE.JPEG,
			row.file_sha256,
		)
		if (original === undefined) {
			this.logger.error(`The original of ${kind} ${row.file_id} is not confirmed in the clinical record`)
			return undefined
		}
		const patientResourceId = await this.linkOf(tx, FHIR_RESOURCE_TYPE.PATIENT, LOCAL_KIND.PATIENT, row.patient_id)
		const encounterResourceId = await this.linkOf(
			tx,
			FHIR_RESOURCE_TYPE.ENCOUNTER,
			LOCAL_KIND.ENCOUNTER,
			row.encounter_id,
		)
		if (patientResourceId === undefined || encounterResourceId === undefined) {
			this.logger.error(`The ${kind} ${row.file_id} has no patient or encounter in the clinical record`)
			return undefined
		}
		const base: FileResourceBase = {
			fileId: row.file_id,
			acquisitionId: row.acquisition_id,
			sequence: row.sequence,
			department: await this.actors.departmentOf(tx, row.department_id),
			patientResourceId,
			encounterResourceId,
			seriesInstanceUid: row.series_instance_uid,
			sopInstanceUid: row.sop_instance_uid ?? undefined,
		}
		const resourceWith = await this.resourceOf(tx, kind, row, base)
		if (resourceWith === undefined) {
			return undefined
		}
		const renditions = { original, thumbnail: keptOf(row.thumbnail), viewingCopy: keptOf(row.viewing_copy) }
		return { renditions, detaching: detachingOf([row.original, row.thumbnail, row.viewing_copy]), resourceWith }
	}

	// datovy-model.md 13.1 vulna-wound-photo, vulna-document-page
	private async resourceOf(
		tx: postgres.TransactionSql,
		kind: FileResourceObjectKind,
		row: FileResourceRow,
		base: FileResourceBase,
	): Promise<FileResourceDraft["resourceWith"] | undefined> {
		switch (kind) {
			case JOB_OBJECT_KIND.IMAGE:
				return await this.imageOf(tx, row, base)
			case JOB_OBJECT_KIND.DOCUMENT_PAGE:
				return await this.pageOf(tx, row, base)
			default:
				return kind satisfies never
		}
	}

	private async imageOf(
		tx: postgres.TransactionSql,
		row: FileResourceRow,
		base: FileResourceBase,
	): Promise<FileResourceDraft["resourceWith"] | undefined> {
		const studyResourceId = await this.linkOf(
			tx,
			FHIR_RESOURCE_TYPE.IMAGING_STUDY,
			LOCAL_KIND.IMAGING_STUDY,
			row.encounter_id,
		)
		const findingResourceId =
			row.finding_id === null
				? undefined
				: await this.linkOf(tx, FHIR_RESOURCE_TYPE.CONDITION, LOCAL_KIND.FINDING, row.finding_id)
		if (studyResourceId === undefined || findingResourceId === undefined) {
			this.logger.error(`The image ${row.file_id} has no study or finding in the clinical record`)
			return undefined
		}
		const assessmentResourceId = await this.linkOf(
			tx,
			FHIR_RESOURCE_TYPE.OBSERVATION,
			LOCAL_KIND.ASSESSMENT,
			row.acquisition_id,
		)
		return (renditions) => ({
			...base,
			...renditions,
			kind: CLINICAL_FILE_KIND.IMAGE,
			studyResourceId,
			findingResourceId,
			assessmentResourceId,
		})
	}

	private async pageOf(
		tx: postgres.TransactionSql,
		row: FileResourceRow,
		base: FileResourceBase,
	): Promise<FileResourceDraft["resourceWith"] | undefined> {
		const documentResourceId =
			row.document_id === null
				? undefined
				: await this.linkOf(tx, FHIR_RESOURCE_TYPE.DOCUMENT_REFERENCE, LOCAL_KIND.DOCUMENT, row.document_id)
		if (documentResourceId === undefined) {
			this.logger.error(`The page ${row.file_id} has no document in the clinical record`)
			return undefined
		}
		return (renditions) => ({ ...base, ...renditions, kind: CLINICAL_FILE_KIND.DOCUMENT_PAGE, documentResourceId })
	}

	private async linkOf(
		tx: postgres.TransactionSql,
		resourceType: string,
		localKind: string,
		localId: string,
	): Promise<string | undefined> {
		return await this.links.resourceIdOf(tx, { resourceType, localKind, localId })
	}
}
