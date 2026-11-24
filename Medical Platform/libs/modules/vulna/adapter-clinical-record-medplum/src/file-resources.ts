import {
	CLINICAL_FILE_KIND,
	CLINICAL_RECORD_FAILURE,
	type ClinicalArchivedFile,
	type ClinicalFileRendition,
	type ClinicalFileResource,
	type ClinicalImageResource,
	ClinicalRecordStoreError,
	isStoredFile,
} from "@ansora/vulna-domain/ports"
import { seriesInstanceUidIdentifierOf, sopInstanceUidIdentifierOf } from "./dicom-identifiers"
import { CURRENT_DOCUMENT } from "./document-resources"
import { PATIENT_REFERENCE } from "./draft-records"
import type {
	Attachment,
	CodeableConcept,
	DocumentReference,
	DocumentReferenceContent,
	Extension,
	Reference,
} from "./fhir-types"
import { tokenOf } from "./identifiers"
import { CONDITION_REFERENCE, LOINC } from "./observation-resources"
import { closedMetaOf, type ProjectionContext } from "./resource-meta"
import { ENCOUNTER_REFERENCE } from "./study-resources"

// datovy-model.md 13.1 vulna-wound-photo
const PHOTOGRAPHIC_IMAGE = "72170-4"
// ADR-050 bod 13
const THUMBNAIL_EXTENSION = "http://hl7.org/fhir/StructureDefinition/documentreference-thumbnail"
const STORED = "stored"
const ARCHIVE_ONLY = "archive-only"
const VIEWING_COPY = "viewing-copy"
const WOUND_PHOTO = "wound-photo"
const DOCUMENT_PAGE = "document-page"
export const BINARY_REFERENCE = "Binary/"
const OBSERVATION_REFERENCE = "Observation/"
export const IMAGING_STUDY_REFERENCE = "ImagingStudy/"
const DOCUMENT_REFERENCE = "DocumentReference/"

// ADR-050 bod 13, CAP-021-R37, CAP-021-R39
export function attachmentOf(rendition: ClinicalFileRendition, context: ProjectionContext): Attachment {
	return {
		contentType: rendition.contentType,
		url: `${BINARY_REFERENCE}${rendition.binaryId}`,
		size: rendition.sizeBytes,
		hash: rendition.sha1Base64,
		extension: [{ url: context.systems.attachmentSha256, valueString: rendition.sha256 }],
	}
}

// CAP-021-R37, CAP-026-R19, CAP-026-R20, datovy-model.md 13.4, ADR-050 bod 14
export function archivedAttachmentOf(
	file: ClinicalArchivedFile,
	sopInstanceUid: string | undefined,
	subject: string,
	context: ProjectionContext,
): Attachment {
	if (sopInstanceUid === undefined) {
		throw new ClinicalRecordStoreError(
			CLINICAL_RECORD_FAILURE.REJECTED,
			`${subject} is kept only in the PACS but has no SOP Instance UID`,
		)
	}
	const availability: Extension = { url: context.systems.contentAvailability, valueCode: ARCHIVE_ONLY }
	if (file.sha256 === undefined) {
		return { contentType: file.contentType, extension: [availability] }
	}
	return {
		contentType: file.contentType,
		extension: [{ url: context.systems.attachmentSha256, valueString: file.sha256 }, availability],
	}
}

// CAP-021-R37, CAP-026-R19
function originalAttachmentOf(file: ClinicalFileResource, context: ProjectionContext): Attachment {
	if (!isStoredFile(file.original)) {
		const subject = `the original of ${file.kind} ${file.fileId}`
		return archivedAttachmentOf(file.original, file.sopInstanceUid, subject, context)
	}
	const original = attachmentOf(file.original, context)
	return {
		...original,
		extension: [...(original.extension ?? []), { url: context.systems.contentAvailability, valueCode: STORED }],
	}
}

function thumbnailMarkOf(isThumbnail: boolean): Extension {
	return { url: THUMBNAIL_EXTENSION, valueBoolean: isThumbnail }
}

// ADR-050 bod 13, CAP-021-R37, CAP-021-R40, CAP-026-R19, CAP-026-R20
function fileContentOf(file: ClinicalFileResource, context: ProjectionContext): DocumentReferenceContent[] {
	const content: DocumentReferenceContent[] = [
		{ extension: [thumbnailMarkOf(false)], attachment: originalAttachmentOf(file, context) },
	]
	if (file.thumbnail !== undefined) {
		content.push({ extension: [thumbnailMarkOf(true)], attachment: attachmentOf(file.thumbnail, context) })
	}
	if (file.viewingCopy !== undefined) {
		content.push({
			extension: [thumbnailMarkOf(false), { url: context.systems.attachmentKind, valueCode: VIEWING_COPY }],
			attachment: attachmentOf(file.viewingCopy, context),
		})
	}
	return content
}

function imageRelationsOf(image: ClinicalImageResource): Reference[] {
	const related: Reference[] = [{ reference: `${CONDITION_REFERENCE}${image.findingResourceId}` }]
	if (image.assessmentResourceId !== undefined) {
		related.push({ reference: `${OBSERVATION_REFERENCE}${image.assessmentResourceId}` })
	}
	related.push({ reference: `${IMAGING_STUDY_REFERENCE}${image.studyResourceId}` })
	return related
}

function relationsOf(file: ClinicalFileResource): Reference[] {
	switch (file.kind) {
		case CLINICAL_FILE_KIND.IMAGE:
			return imageRelationsOf(file)
		case CLINICAL_FILE_KIND.DOCUMENT_PAGE:
			return [{ reference: `${DOCUMENT_REFERENCE}${file.documentResourceId}` }]
		default:
			return file satisfies never
	}
}

function categoryOf(file: ClinicalFileResource, context: ProjectionContext): CodeableConcept {
	const code = file.kind === CLINICAL_FILE_KIND.IMAGE ? WOUND_PHOTO : DOCUMENT_PAGE
	return { coding: [{ system: context.systems.imageKind, code }] }
}

function profileOf(file: ClinicalFileResource, context: ProjectionContext): string {
	return file.kind === CLINICAL_FILE_KIND.IMAGE
		? context.systems.woundPhotoProfile
		: context.systems.documentPageProfile
}

function fileSystemOf(file: ClinicalFileResource, context: ProjectionContext): string {
	return file.kind === CLINICAL_FILE_KIND.IMAGE ? context.systems.image : context.systems.documentPage
}

// datovy-model.md 13.1, ADR-050 bod 13
export function fileTokenOf(file: ClinicalFileResource, context: ProjectionContext): string {
	return tokenOf(fileSystemOf(file, context), file.fileId)
}

// datovy-model.md 13.1, ADR-050 bod 13, ADR-050 bod 15, CAP-021-R37
export function fileResourceOf(file: ClinicalFileResource, context: ProjectionContext): DocumentReference {
	const resource: DocumentReference = {
		resourceType: "DocumentReference",
		meta: closedMetaOf(profileOf(file, context), file.department, context),
		extension: [{ url: context.systems.fileSequence, valuePositiveInt: file.sequence }],
		identifier: [
			{ system: fileSystemOf(file, context), value: file.fileId },
			{ system: context.systems.acquisition, value: file.acquisitionId },
			seriesInstanceUidIdentifierOf(file.seriesInstanceUid),
		],
		status: CURRENT_DOCUMENT,
		category: [categoryOf(file, context)],
		subject: { reference: `${PATIENT_REFERENCE}${file.patientResourceId}` },
		content: fileContentOf(file, context),
		context: {
			encounter: [{ reference: `${ENCOUNTER_REFERENCE}${file.encounterResourceId}` }],
			related: relationsOf(file),
		},
	}
	if (file.kind === CLINICAL_FILE_KIND.IMAGE) {
		resource.type = { coding: [{ system: LOINC, code: PHOTOGRAPHIC_IMAGE }] }
	}
	// integrace-dicom.md 5.9, CAP-021-R28, backend.md 3 T4b
	if (file.sopInstanceUid !== undefined) {
		resource.masterIdentifier = sopInstanceUidIdentifierOf(file.sopInstanceUid)
	}
	return resource
}
