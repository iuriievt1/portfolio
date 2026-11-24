import { randomUUID } from "node:crypto"
import {
	type ClinicalClosure,
	type ClinicalDeliveredDocument,
	type ClinicalDocumentTitle,
	type ClinicalFirstWoundRecord,
	type ClinicalScanClosure,
	type ClinicalScannedDocument,
	type ClinicalScannedDocumentPdf,
	type ClinicalSeries,
	type ClinicalStation,
	type ClinicalWoundClosure,
	CODE_LIST,
	findingSiteKeyOf,
	isStoredFile,
} from "@ansora/vulna-domain/ports"
import { conditionalUpdateAt, urnOf } from "./bundle-entries"
import {
	MODALITY,
	type Modality,
	modalityOf,
	seriesInstanceUidIdentifierOf,
	sopInstanceUidIdentifierOf,
} from "./dicom-identifiers"
import { CURRENT_DOCUMENT, FINAL_DOCUMENT, scannedDocumentContentOf } from "./document-resources"
import { FINDING_RECORD, PATIENT_REFERENCE } from "./draft-records"
import type {
	Attachment,
	Bundle,
	BundleEntry,
	CodeableConcept,
	Device,
	DocumentReference,
	DocumentReferenceContent,
	ImagingStudy,
	ImagingStudySeries,
	ImagingStudySeriesPerformer,
	Observation,
	Organization,
	Practitioner,
	PractitionerRole,
	Reference,
	Resource,
} from "./fhir-types"
import { archivedAttachmentOf, attachmentOf } from "./file-resources"
import { bodyStructureOf, conditionOf } from "./finding-resources"
import { type IdentifierSystems, tokenOf } from "./identifiers"
import {
	assessmentObservationOf,
	codeListValueOf,
	woundTypeConcept,
	woundTypeObservationOf,
} from "./observation-resources"
import {
	acquisitionProvenanceKeyOf,
	PROVENANCE_ROLE,
	type ProvenanceStatement,
	provenanceEntryOf,
} from "./provenance-resources"
import { closedMetaOf, type ProjectionContext } from "./resource-meta"
import { LATERALITY_SNOMED, SNOMED_CT } from "./snomed-codes"
import { ENCOUNTER_REFERENCE, STUDY_STATUS, seriesWith, studyResourceOf } from "./study-resources"

// integrace-dicom.md 5.9
const STATION_NAME_TYPE = "model-name"
const CLOSURE_EVENT = "closed"

// ADR-050, integrace-dicom.md 5.9
export interface ClosureReferences {
	author: Reference<Practitioner | PractitionerRole>
	station: Reference<Device>
	department: Reference<Organization> | undefined
	existingStudy: ImagingStudy | undefined
}

interface PlacedEntry {
	fullUrl: string
	entry: BundleEntry
}

// ADR-050, integrace-dicom.md 5.9
export function stationDeviceOf(station: ClinicalStation, systems: IdentifierSystems): Device {
	return {
		resourceType: "Device",
		identifier: [{ system: systems.device, value: station.deviceId }],
		status: "active",
		deviceName: [{ name: station.model, type: STATION_NAME_TYPE }],
	}
}

// ADR-050
function placed(resource: Resource, identifier: string): PlacedEntry {
	const fullUrl = urnOf(randomUUID())
	return { fullUrl, entry: conditionalUpdateAt(fullUrl, resource, identifier) }
}

// integrace-dicom.md 5.9
function performersOf(references: ClosureReferences): ImagingStudySeriesPerformer[] {
	const actors = references.department === undefined ? [] : [references.department]
	return [references.author, references.station, ...actors].map((actor) => ({ actor }))
}

function mergedPerformers(
	existing: readonly ImagingStudySeriesPerformer[] | undefined,
	added: readonly ImagingStudySeriesPerformer[],
): ImagingStudySeriesPerformer[] {
	const known = new Set((existing ?? []).map((performer) => performer.actor.reference))
	return [...(existing ?? []), ...added.filter((performer) => !known.has(performer.actor.reference))]
}

// datovy-model.md 3, integrace-dicom.md 5.9, ADR-050
function seriesOf(
	existing: ImagingStudySeries | undefined,
	series: ClinicalSeries,
	modality: Modality,
	performers: readonly ImagingStudySeriesPerformer[],
): ImagingStudySeries {
	const merged: ImagingStudySeries = {
		...existing,
		uid: series.seriesInstanceUid,
		number: series.number,
		modality: modalityOf(modality),
		performer: mergedPerformers(existing?.performer, performers),
	}
	if (series.bodyRegion !== undefined) {
		merged.bodySite = { system: SNOMED_CT, code: series.bodyRegion.code }
	}
	if (series.laterality !== null) {
		merged.laterality = { system: SNOMED_CT, code: LATERALITY_SNOMED[series.laterality] }
	}
	return merged
}

// ADR-050, datovy-model.md 13.1, integrace-dicom.md 5.9
export function imagingStudyOf(
	closure: ClinicalClosure,
	modality: Modality,
	references: ClosureReferences,
	context: ProjectionContext,
): ImagingStudy {
	const existing = references.existingStudy
	const own = seriesOf(
		existing?.series?.find((candidate) => candidate.uid === closure.series.seriesInstanceUid),
		closure.series,
		modality,
		performersOf(references),
	)
	return studyResourceOf(
		{
			existing,
			study: closure.study,
			patientResourceId: closure.patientResourceId,
			meta: closedMetaOf(context.systems.imagingStudyProfile, closure.study.department, context),
			status: existing?.status === STUDY_STATUS.AVAILABLE ? STUDY_STATUS.AVAILABLE : STUDY_STATUS.REGISTERED,
			series: seriesWith(existing?.series, own),
		},
		context.systems,
	)
}

function studyEntryOf(
	closure: ClinicalClosure,
	modality: Modality,
	references: ClosureReferences,
	context: ProjectionContext,
): PlacedEntry {
	return placed(
		imagingStudyOf(closure, modality, references, context),
		tokenOf(context.systems.imagingStudy, closure.study.encounterId),
	)
}

// ADR-050, ADR-052
function firstRecordEntriesOf(
	firstRecord: ClinicalFirstWoundRecord,
	references: ClosureReferences,
	context: ProjectionContext,
): PlacedEntry[] {
	const { systems } = context
	const { finding, woundType } = firstRecord
	const siteKey = findingSiteKeyOf(finding.findingId, finding.site.bodyDiagramVersion)
	const condition = { ...conditionOf(finding, FINDING_RECORD.CLOSED, context), recorder: references.author }
	const entries = [
		placed(bodyStructureOf(finding, FINDING_RECORD.CLOSED, context), tokenOf(systems.findingSite, siteKey)),
		placed(condition, tokenOf(systems.finding, finding.findingId)),
	]
	// CAP-017-R16, CHG-181
	if (woundType === undefined) {
		return entries
	}
	const woundTypeObservation: Observation = {
		...woundTypeObservationOf(woundType, FINDING_RECORD.CLOSED, context),
		performer: [references.author],
	}
	return [...entries, placed(woundTypeObservation, tokenOf(systems.findingWoundType, woundType.findingId))]
}

// ADR-050, CAP-020-R21, datovy-model.md 13.1, integrace-dicom.md 5.9
function closedAssessmentOf(
	closure: ClinicalWoundClosure,
	studyUrl: string,
	references: ClosureReferences,
	context: ProjectionContext,
): Observation {
	const observation: Observation = {
		...assessmentObservationOf(closure.assessment, FINDING_RECORD.CLOSED, context),
		partOf: [{ reference: studyUrl }],
		effectiveDateTime: closure.startedAt,
		performer: [references.author],
	}
	// CAP-017-R16, CHG-181
	if (closure.closedWoundType !== undefined) {
		const { code, name } = closure.closedWoundType
		observation.component = [
			{
				code: woundTypeConcept(),
				valueCodeableConcept: codeListValueOf(context.instanceBase, CODE_LIST.WOUND_TYPE, code, name),
			},
		]
	}
	return observation
}

// ADR-050, datovy-model.md 13.1
function closureEntryOf(
	closure: ClinicalClosure,
	placedEntries: readonly PlacedEntry[],
	references: ClosureReferences,
	context: ProjectionContext,
): BundleEntry {
	const statement: ProvenanceStatement = {
		key: acquisitionProvenanceKeyOf(closure.acquisitionId, CLOSURE_EVENT),
		patientId: closure.patientId,
		targets: placedEntries.map((placedEntry) => placedEntry.fullUrl),
		recorded: closure.closedAt,
		occurred: undefined,
		agents: [
			{ role: PROVENANCE_ROLE.AUTHOR, who: references.author },
			{ role: PROVENANCE_ROLE.COMPOSER, who: references.station },
		],
	}
	return provenanceEntryOf(statement, context.systems)
}

function closureBundleOf(
	closure: ClinicalClosure,
	placedEntries: readonly PlacedEntry[],
	references: ClosureReferences,
	context: ProjectionContext,
): Bundle {
	return {
		resourceType: "Bundle",
		type: "transaction",
		entry: [
			...placedEntries.map((placedEntry) => placedEntry.entry),
			closureEntryOf(closure, placedEntries, references, context),
		],
	}
}

// ADR-050, ADR-052, ADR-054
export function woundClosureBundleOf(
	closure: ClinicalWoundClosure,
	references: ClosureReferences,
	context: ProjectionContext,
): Bundle {
	const study = studyEntryOf(closure, MODALITY.PHOTO, references, context)
	const assessment = placed(
		closedAssessmentOf(closure, study.fullUrl, references, context),
		tokenOf(context.systems.acquisition, closure.acquisitionId),
	)
	const firstRecord =
		closure.firstRecord === undefined ? [] : firstRecordEntriesOf(closure.firstRecord, references, context)
	return closureBundleOf(closure, [...firstRecord, study, assessment], references, context)
}

// ADR-050, CAP-018-R15, datovy-model.md 13.1
function documentTypeOf(title: ClinicalDocumentTitle, context: ProjectionContext): CodeableConcept {
	if (title.code !== undefined) {
		return codeListValueOf(context.instanceBase, CODE_LIST.DOCUMENT_TITLE, title.code, title.text)
	}
	const type: CodeableConcept = {}
	if (title.text !== undefined) {
		type.text = title.text
	}
	return type
}

// ADR-050, datovy-model.md 13.1, integrace-dicom.md 5.9
export function scannedDocumentOf(
	document: ClinicalScannedDocument,
	studyReference: string,
	author: Reference<Practitioner | PractitionerRole>,
	content: DocumentReferenceContent,
	context: ProjectionContext,
): DocumentReference {
	const { systems } = context
	return {
		resourceType: "DocumentReference",
		meta: closedMetaOf(systems.scannedDocumentProfile, document.department, context),
		identifier: [
			{ system: systems.document, value: document.documentId },
			{ system: systems.acquisition, value: document.acquisitionId },
			seriesInstanceUidIdentifierOf(document.series.seriesInstanceUid),
		],
		status: CURRENT_DOCUMENT,
		docStatus: FINAL_DOCUMENT,
		type: documentTypeOf(document.title, context),
		subject: { reference: `${PATIENT_REFERENCE}${document.patientResourceId}` },
		date: document.closedAt,
		author: [author],
		content: [content],
		context: {
			encounter: [{ reference: `${ENCOUNTER_REFERENCE}${document.study.encounterResourceId}` }],
			related: [{ reference: studyReference }],
		},
	}
}

// CAP-021-R39, CAP-026-R20, ADR-050 bod 6, datovy-model.md 13.1 vulna-scanned-document, backend.md 3.1 T7
function pdfAttachmentOf(document: ClinicalScannedDocumentPdf, context: ProjectionContext): Attachment {
	if (isStoredFile(document.pdf)) {
		return attachmentOf(document.pdf, context)
	}
	const subject = `the PDF of document ${document.documentId}`
	return archivedAttachmentOf(document.pdf, document.delivered?.sopInstanceUid, subject, context)
}

// CAP-021-R39, ADR-050 bod 6, datovy-model.md 13.1 vulna-scanned-document, backend.md 3.1 T7
function scannedPdfContentOf(
	document: ClinicalScannedDocumentPdf,
	context: ProjectionContext,
): DocumentReferenceContent {
	const { delivered } = document
	const { attachment, format } = scannedDocumentContentOf(document.pageCount)
	const binary = pdfAttachmentOf(document, context)
	return {
		attachment: {
			...binary,
			contentType: attachment.contentType,
			extension: [...(attachment.extension ?? []), ...(binary.extension ?? [])],
			...deliveredAttachmentOf(delivered),
		},
		format,
	}
}

// integrace-dicom.md 5.9 pravidlo 2
function deliveredAttachmentOf(delivered: ClinicalDeliveredDocument | undefined): Attachment {
	if (delivered === undefined) {
		return {}
	}
	const fields: Attachment = {}
	if (delivered.createdAt !== undefined) {
		fields.creation = delivered.createdAt
	}
	if (delivered.title !== undefined) {
		fields.title = delivered.title
	}
	if (delivered.language !== undefined) {
		fields.language = delivered.language
	}
	return fields
}

// CAP-021-R39, CAP-021-R28, integrace-dicom.md 5.9, backend.md 3.1 T7, backend.md 3 T4b
export function scannedPdfDocumentOf(
	document: ClinicalScannedDocumentPdf,
	studyReference: string,
	author: Reference<Practitioner | PractitionerRole>,
	context: ProjectionContext,
): DocumentReference {
	const content = scannedPdfContentOf(document, context)
	const resource = scannedDocumentOf(document, studyReference, author, content, context)
	if (document.delivered !== undefined) {
		resource.masterIdentifier = sopInstanceUidIdentifierOf(document.delivered.sopInstanceUid)
	}
	return resource
}

// ADR-050, ADR-054
export function scanClosureBundleOf(
	closure: ClinicalScanClosure,
	references: ClosureReferences,
	context: ProjectionContext,
): Bundle {
	const study = studyEntryOf(closure, MODALITY.DOCUMENT, references, context)
	const document = placed(
		scannedDocumentOf(closure, study.fullUrl, references.author, scannedDocumentContentOf(closure.pageCount), context),
		tokenOf(context.systems.document, closure.documentId),
	)
	return closureBundleOf(closure, [study, document], references, context)
}
