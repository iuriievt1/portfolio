import {
	CLINICAL_CONTENT_TYPE,
	type ClinicalDraftDocument,
	type ClinicalFoundedDocument,
	type ClinicalStudySeries,
} from "@ansora/vulna-domain/ports"
import { conditionalUpdate } from "./bundle-entries"
import { MODALITY, modalityOf } from "./dicom-identifiers"
import { type DraftChange, FINDING_RECORD } from "./draft-records"
import type {
	Bundle,
	DocumentReference,
	DocumentReferenceContent,
	ImagingStudy,
	ImagingStudySeries,
	Meta,
} from "./fhir-types"
import { tokenOf } from "./identifiers"
import { clinicalMetaOf, type ProjectionContext } from "./resource-meta"
import { modalitiesOf, STUDY_STATUS, seriesWith, studyResourceOf } from "./study-resources"

// ADR-050, integrace-dicom.md 5.9
const FORMAT_CODE_SYSTEM = "http://ihe.net/fhir/ihe.formatcode.fhir/CodeSystem/formatcode"
const SCANNED_DOCUMENT_FORMAT = "urn:ihe:iti:xds-sd:pdf:2008"
// ADR-050
export const ATTACHMENT_PAGES = "http://hl7.org/fhir/5.0/StructureDefinition/extension-Attachment.pages"

// ADR-050, ADR-050 (doplnění D33) bod 1
export const CURRENT_DOCUMENT = "current"
// ADR-050, CAP-021-R39
export const FINAL_DOCUMENT = "final"
const PRELIMINARY_DOCUMENT = "preliminary"

// ADR-050 (doplnění D33) bod 3
const DRAFT_DOCUMENT_STATUS: Record<DraftChange, DocumentReference["status"]> = {
	[FINDING_RECORD.DRAFT]: CURRENT_DOCUMENT,
	[FINDING_RECORD.WITHDRAWN]: "entered-in-error",
}

// ADR-050, CAP-021-R39
export function scannedDocumentContentOf(pageCount: number | undefined): DocumentReferenceContent {
	return {
		attachment:
			pageCount === undefined
				? { contentType: CLINICAL_CONTENT_TYPE.PDF }
				: {
						contentType: CLINICAL_CONTENT_TYPE.PDF,
						extension: [{ url: ATTACHMENT_PAGES, valuePositiveInt: pageCount }],
					},
		format: { system: FORMAT_CODE_SYSTEM, code: SCANNED_DOCUMENT_FORMAT },
	}
}

// CAP-021-R39, CAP-021-S34, ADR-050 (doplnění D33) body 1 až 3
export function draftDocumentOf(
	document: ClinicalDraftDocument,
	record: DraftChange,
	context: ProjectionContext,
): DocumentReference {
	const { systems } = context
	return {
		resourceType: "DocumentReference",
		meta: clinicalMetaOf(systems.scannedDocumentProfile, document, record, context),
		identifier: [
			{ system: systems.document, value: document.documentId },
			{ system: systems.acquisition, value: document.acquisitionId },
		],
		status: DRAFT_DOCUMENT_STATUS[record],
		docStatus: PRELIMINARY_DOCUMENT,
		content: [scannedDocumentContentOf(undefined)],
	}
}

// CAP-021-R39, CAP-021-R28, ADR-050 (doplnění D33) body 1 a 2, ⚠ Q-149
export function draftStudyOf(
	existing: ImagingStudy | undefined,
	document: ClinicalFoundedDocument,
	context: ProjectionContext,
): ImagingStudy {
	const own: ImagingStudySeries = {
		uid: document.series.seriesInstanceUid,
		number: document.series.number,
		modality: modalityOf(MODALITY.DOCUMENT),
	}
	const series = seriesWith(existing?.series, own)
	if (existing !== undefined) {
		return { ...existing, modality: modalitiesOf(series), series }
	}
	return studyResourceOf(
		{
			existing: undefined,
			study: document.study,
			patientResourceId: document.patientResourceId,
			meta: clinicalMetaOf(context.systems.imagingStudyProfile, document, FINDING_RECORD.DRAFT, context),
			status: STUDY_STATUS.REGISTERED,
			series,
		},
		context.systems,
	)
}

// ADR-050 (doplnění D33) body 2 a 3
function withoutDraftTagOf(meta: Meta | undefined, acquisitionId: string, context: ProjectionContext): Meta {
	const isOwnDraftTag = (tag: { system?: string; code?: string }) =>
		tag.system === context.systems.draftTag && tag.code === acquisitionId
	return { ...meta, tag: (meta?.tag ?? []).filter((tag) => !isOwnDraftTag(tag)) }
}

// ADR-050 (doplnění D33) bod 3, CAP-015-R17, CAP-014-R25
export function withdrawnStudyOf(
	existing: ImagingStudy,
	withdrawn: ClinicalStudySeries,
	document: ClinicalDraftDocument,
	context: ProjectionContext,
): ImagingStudy {
	const series = (existing.series ?? []).filter((candidate) => candidate.uid !== withdrawn.seriesInstanceUid)
	if (series.length === 0) {
		return { ...existing, status: STUDY_STATUS.ENTERED_IN_ERROR }
	}
	return {
		...existing,
		meta: withoutDraftTagOf(existing.meta, document.acquisitionId, context),
		modality: modalitiesOf(series),
		series,
	}
}

// ADR-050 bod 10
export interface PlacedStudy {
	encounterId: string
	resource: ImagingStudy
}

// CAP-021-R39, ADR-050 bod 10, ADR-054 bod 3
export function draftDocumentBundleOf(
	document: ClinicalDraftDocument,
	resource: DocumentReference,
	study: PlacedStudy | undefined,
	context: ProjectionContext,
): Bundle {
	const { systems } = context
	const entry = [conditionalUpdate(resource, tokenOf(systems.document, document.documentId))]
	if (study !== undefined) {
		entry.push(conditionalUpdate(study.resource, tokenOf(systems.imagingStudy, study.encounterId)))
	}
	return { resourceType: "Bundle", type: "transaction", entry }
}
