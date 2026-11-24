import type { EncounterStatus, Laterality, PatientSex } from "@ansora/contracts"
import type { BodySite, BodySurface, DicomRegionCode } from "../body-diagram"
import type { HistoryWoundRecord } from "./image-history.port"

export {
	ACQUISITION_KIND,
	type AcquisitionKind,
	BODY_VIEWS,
	type BodyView,
	CODE_LIST,
	ENCOUNTER_STATUS,
	type EncounterStatus,
	LATERALITY,
	type Laterality,
	nameIn,
} from "@ansora/contracts"

// ADR-050 bod 5, ADR-053 bod 6, CAP-001-R31, CAP-021-R38
export interface ClinicalActor {
	userId: string
	displayName: string
	department: ActorDepartment | undefined
	roles: readonly string[]
}

export interface ActorDepartment {
	id: string
	code: string
}

// ADR-050 bod 9, CAP-024-R07, NAB-479
export interface ClinicalPatient {
	patientId: string
	familyName: string | undefined
	givenName: string | undefined
	birthDate: string | undefined
	sex: PatientSex | undefined
	identifiers: readonly CustomerIdentifier[]
	demographicsRevision: number
}

export interface CustomerIdentifier {
	system: string
	value: string
	issuer: string | undefined
	validUntil: string | undefined
}

// ADR-050 bod 3, ADR-050 bod 10, CAP-014-R17
export interface ClinicalEncounter {
	encounterId: string
	status: EncounterStatus
	date: string
	startedAt: string | undefined
	statusChangedAt: string
	studyInstanceUid: string
	department: ActorDepartment | undefined
	completedByUserId: string | undefined
}

export interface ClinicalEncounterRecord {
	patient: ClinicalPatient
	encounter: ClinicalEncounter
}

export interface EncounterResourceIds {
	patient: string
	encounter: string
}

// ADR-050 bod 4, CAP-016-R03, CAP-016-R04, CAP-016-R16, CAP-016-R20
export interface ClinicalWoundSite extends BodySite {
	surface: BodySurface
}

// datovy-model.md 13.3, ADR-050 bod 2
export function findingSiteKeyOf(findingId: string, bodyDiagramVersion: string): string {
	return `${findingId}:${bodyDiagramVersion}`
}

// ADR-050 (doplnění D33), CAP-020-R13, CAP-016-R17
export interface ClinicalDraftFinding {
	findingId: string
	acquisitionId: string
	patientResourceId: string
	department: ActorDepartment | undefined
	site: ClinicalWoundSite
}

export interface FindingResourceIds {
	condition: string
	bodyStructure: string
}

// ADR-050 bod 4, CAP-017-R02, CAP-020-R19
export interface ClinicalDraftWoundType {
	findingId: string
	acquisitionId: string
	patientResourceId: string
	conditionResourceId: string
	department: ActorDepartment | undefined
	woundTypeCode: string
	// datovy-model.md 13.1
	woundTypeName: string | undefined
}

// ADR-050 bod 4, CAP-017-R03, CAP-017-R04
export interface ClinicalDraftAssessment {
	acquisitionId: string
	patientResourceId: string
	conditionResourceId: string
	bodyStructureResourceId: string
	department: ActorDepartment | undefined
	// CAP-017-R16, CHG-181
	healingPhaseCode: string | undefined
	// datovy-model.md 13.1
	healingPhaseName: string | undefined
	description: string | undefined
}

// CAP-021-R39, ADR-050 (doplnění D33) bod 1
export interface ClinicalDraftDocument {
	documentId: string
	acquisitionId: string
	department: ActorDepartment | undefined
}

// CAP-021-R39, CAP-021-R28, ADR-050 (doplnění D33) bod 1
export interface ClinicalFoundedDocument extends ClinicalDraftDocument {
	patientResourceId: string
	study: ClinicalStudy
	series: ClinicalSeries
}

// ADR-050 (doplnění D33) bod 3, CAP-015-R17
export interface ClinicalStudySeries {
	encounterId: string
	seriesInstanceUid: string
}

// ADR-050 (doplnění D33) bod 3, CAP-015-R17, CAP-014-R25
export interface ClinicalWithdrawnDocument extends ClinicalDraftDocument {
	series: ClinicalStudySeries | undefined
}

export interface DraftDocumentResourceIds {
	document: string
	imagingStudy: string
}

// ADR-050, CAP-021-R26
export interface ClinicalCodedValue {
	code: string
	// datovy-model.md 13.1
	name: string | undefined
}

// ADR-050
export interface ClinicalAuthor {
	userId: string
	department: ActorDepartment | undefined
}

// ADR-050, integrace-dicom.md 5.9
export interface ClinicalStation {
	deviceId: string
	model: string
}

// datovy-model.md 3, integrace-dicom.md 5.9, CAP-021-R11
export interface ClinicalSeries {
	seriesInstanceUid: string
	number: number
	bodyRegion: DicomRegionCode | undefined
	laterality: Laterality | null
}

// ADR-050, integrace-dicom.md 5.9
export interface ClinicalStudy {
	encounterId: string
	encounterResourceId: string
	studyInstanceUid: string
	started: string | undefined
	department: ActorDepartment | undefined
}

// ADR-050, ADR-052, CAP-021-R31
export interface ClinicalClosure {
	acquisitionId: string
	patientId: string
	patientResourceId: string
	department: ActorDepartment | undefined
	startedAt: string
	closedAt: string
	author: ClinicalAuthor
	station: ClinicalStation
	study: ClinicalStudy
	series: ClinicalSeries
}

// ADR-050, CAP-020-R13
export interface ClinicalFirstWoundRecord {
	finding: ClinicalDraftFinding
	// CAP-017-R16, CHG-181
	woundType: ClinicalDraftWoundType | undefined
}

// ADR-050, CAP-020-R21
export interface ClinicalWoundClosure extends ClinicalClosure {
	firstRecord: ClinicalFirstWoundRecord | undefined
	assessment: ClinicalDraftAssessment
	// CAP-017-R16, CHG-181
	closedWoundType: ClinicalCodedValue | undefined
}

// CAP-020-R21, ADR-049 (doplnění D32), ADR-050 bod 10
export interface ClinicalWoundTypeChange {
	changeId: string
	findingId: string
	patientId: string
	patientResourceId: string
	conditionResourceId: string
	department: ActorDepartment | undefined
	woundTypeCode: string
	// datovy-model.md 13.1
	woundTypeName: string | undefined
	changedAt: string
	author: ClinicalAuthor
}

// ADR-050, CAP-018-R15
export interface ClinicalDocumentTitle {
	code: string | undefined
	text: string | undefined
}

// ADR-050, CAP-021-R39
export interface ClinicalScanClosure extends ClinicalClosure {
	documentId: string
	title: ClinicalDocumentTitle
	pageCount: number
}

// CAP-021-R39, ADR-050
export interface ClinicalScannedDocument
	extends Pick<
		ClinicalScanClosure,
		"acquisitionId" | "documentId" | "patientResourceId" | "department" | "closedAt" | "author" | "title" | "pageCount"
	> {
	study: Pick<ClinicalStudy, "encounterResourceId">
	series: Pick<ClinicalSeries, "seriesInstanceUid">
}

// integrace-dicom.md 5.9, CAP-021-R28
export interface ClinicalDeliveredDocument {
	sopInstanceUid: string
	title: string | undefined
	language: string | undefined
	// integrace-dicom.md 5.9
	createdAt: string | undefined
}

// CAP-021-R39, CAP-021-R36, backend.md 3.1 T7, T4
export interface ClinicalScannedDocumentPdf extends ClinicalScannedDocument {
	studyResourceId: string
	pdf: ClinicalFileContent
	delivered: ClinicalDeliveredDocument | undefined
}

// integrace-dicom.md 5.9, CAP-021-R28
export interface ClinicalDeliveredInstance {
	seriesInstanceUid: string
	sopClassUid: string
	sopInstanceUid: string
	number: number
	title: string | undefined
	description: string | undefined
	seriesDescription: string | undefined
}

// CAP-021-R28, backend.md 3 T4, datovy-model.md 13.1
export interface ClinicalDelivery {
	acquisitionId: string
	patientId: string
	study: Pick<ClinicalStudy, "encounterId">
	instances: readonly ClinicalDeliveredInstance[]
	// integrace-dicom.md 5.9
	createdAt: string | undefined
	confirmedAt: string
}

export interface ClosureResourceIds {
	imagingStudy: string
	station: string
}

export interface ScanClosureResourceIds extends ClosureResourceIds {
	document: string
}

// CAP-017-R20, ADR-050 bod 7
export interface ClinicalCodeListConcept {
	code: string
	isActive: boolean
	names: Readonly<Record<string, string>>
}

export interface ClinicalCodeList {
	code: string
	title: string
	concepts: readonly ClinicalCodeListConcept[]
}

export interface ClinicalCodeListSet {
	version: string
	defaultLanguage: string
	codeLists: readonly ClinicalCodeList[]
}

// CAP-021-R37, ADR-050 bod 13
export const CLINICAL_FILE_KIND = {
	IMAGE: "image",
	DOCUMENT_PAGE: "document_page",
} as const

// CAP-015-R13, CAP-018-R12, CAP-021-R39, ADR-050
export const CLINICAL_CONTENT_TYPE = {
	JPEG: "image/jpeg",
	PDF: "application/pdf",
} as const

// CAP-021-R36, CAP-021-R37, ADR-050 bod 13
export interface ClinicalFileRendition {
	binaryId: string
	contentType: string
	sizeBytes: number
	sha1Base64: string
	sha256: string
}

// CAP-021-R37, CAP-026-R19, CAP-026-R20, datovy-model.md 5
export interface ClinicalArchivedFile {
	contentType: string
	sha256: string | undefined
}

export type ClinicalFileContent = ClinicalFileRendition | ClinicalArchivedFile

export function isStoredFile(content: ClinicalFileContent): content is ClinicalFileRendition {
	return "binaryId" in content
}

interface ClinicalFileBase {
	fileId: string
	acquisitionId: string
	sequence: number
	department: ActorDepartment | undefined
	patientResourceId: string
	encounterResourceId: string
	seriesInstanceUid: string
	// integrace-dicom.md 5.9, CAP-021-R28
	sopInstanceUid: string | undefined
	original: ClinicalFileContent
	thumbnail: ClinicalFileRendition | undefined
	viewingCopy: ClinicalFileRendition | undefined
}

// datovy-model.md 13.1 vulna-wound-photo
export interface ClinicalImageResource extends ClinicalFileBase {
	kind: typeof CLINICAL_FILE_KIND.IMAGE
	findingResourceId: string
	assessmentResourceId: string | undefined
	studyResourceId: string
}

// datovy-model.md 13.1 vulna-document-page
export interface ClinicalPageResource extends ClinicalFileBase {
	kind: typeof CLINICAL_FILE_KIND.DOCUMENT_PAGE
	documentResourceId: string
}

export type ClinicalFileResource = ClinicalImageResource | ClinicalPageResource

// ADR-050 bod 10
export const CLINICAL_RECORD_FAILURE = {
	UNAVAILABLE: "unavailable",
	REJECTED: "rejected",
	// CAP-021-R27
	UNKNOWN: "unknown",
} as const

export type ClinicalRecordFailure = (typeof CLINICAL_RECORD_FAILURE)[keyof typeof CLINICAL_RECORD_FAILURE]

export class ClinicalRecordStoreError extends Error {
	constructor(
		readonly failure: ClinicalRecordFailure,
		message: string,
	) {
		super(message)
		this.name = "ClinicalRecordStoreError"
	}
}

// ADR-050, CAP-020-S10
export function isClinicalRecordUnavailability(error: unknown): boolean {
	return error instanceof ClinicalRecordStoreError && error.failure !== CLINICAL_RECORD_FAILURE.REJECTED
}

export function isClinicalRecordRejection(error: unknown): boolean {
	return error instanceof ClinicalRecordStoreError && error.failure === CLINICAL_RECORD_FAILURE.REJECTED
}

// CAP-028-R20, CAP-028-R22
export const CLINICAL_RECORD_FAILURE_CHECKS = {
	isUnavailability: isClinicalRecordUnavailability,
	isAnswer: isClinicalRecordRejection,
}

// ADR-054 bod 4, integrace-dicom.md 2, 5.3
export type ClosedSeries = Pick<ClinicalSeries, "seriesInstanceUid" | "number">

// ADR-054 bod 4, integrace-dicom.md 2, 5.2
export interface StoredStudy {
	patientResourceId: string
	studyInstanceUid: string
	series: readonly ClosedSeries[]
}

// ADR-054 bod 4, integrace-dicom.md 2
export interface StoredRecord {
	acquisitionId: string
	patientResourceId: string
	study: StoredStudy
}

// ADR-054 bod 4, CAP-021-R14, CAP-021-R15, integrace-dicom.md 5.3, 5.4
export interface StoredWoundRecord
	extends StoredRecord,
		Pick<HistoryWoundRecord, "healingPhaseCode" | "closedWoundTypeCode" | "description"> {
	findingId: string
	site: BodySite
}

// ADR-054 bod 4, CAP-021-R39, integrace-dicom.md 5.6
export interface StoredScanRecord extends StoredRecord {
	documentId: string
	title: ClinicalDocumentTitle
}

// ADR-054 bod 4, integrace-dicom.md 2
export class ClosedRecordConflictError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "ClosedRecordConflictError"
	}
}

// ADR-054 bod 4, CAP-012-R30, CAP-021-R27, integrace-dicom.md 2
export interface ClosedRecordReaderPort {
	closedWoundRecord(acquisitionId: string): Promise<StoredWoundRecord | undefined>
	closedScanRecord(acquisitionId: string): Promise<StoredScanRecord | undefined>
}

// ADR-054 bod 1, ADR-052 bod 7, architektura.md 3
export interface ClinicalRecordStorePort {
	// datovy-model.md 13.2
	recordActor(actor: ClinicalActor): Promise<string>
	// CAP-014-R17, ADR-054 bod 3
	recordEncounter(record: ClinicalEncounterRecord): Promise<EncounterResourceIds>
	// CAP-016-R17, CAP-020-R13, ADR-052 bod 3, ADR-054 bod 3
	recordDraftFinding(finding: ClinicalDraftFinding): Promise<FindingResourceIds>
	// ADR-050 (doplnění D33) bod 3, ADR-050 bod 10, ADR-052 bod 6, CAP-020-R13
	withdrawDraftFinding(finding: ClinicalDraftFinding, woundType: ClinicalDraftWoundType | undefined): Promise<void>
	// CAP-017-R02, ADR-052 bod 3, ADR-054 bod 3
	recordDraftWoundType(woundType: ClinicalDraftWoundType): Promise<string>
	// CAP-017-R03, CAP-017-R04, ADR-052 bod 3, ADR-054 bod 3
	recordDraftAssessment(assessment: ClinicalDraftAssessment): Promise<string>
	// ADR-050 (doplnění D33) bod 3, ADR-052 bod 6
	withdrawDraftAssessment(assessment: ClinicalDraftAssessment): Promise<void>
	// CAP-021-R39, ADR-052 bod 3, ADR-054 bod 3
	recordDraftDocument(document: ClinicalFoundedDocument): Promise<DraftDocumentResourceIds>
	// CAP-021-R39, ADR-050 (doplnění D33) bod 3, ADR-052 bod 6
	withdrawDraftDocument(document: ClinicalWithdrawnDocument): Promise<void>
	// CAP-021-R27, CAP-021-R31, ADR-050, ADR-054
	recordWoundClosure(closure: ClinicalWoundClosure): Promise<ClosureResourceIds>
	// CAP-021-R27, CAP-021-R39, ADR-050, ADR-054
	recordScanClosure(closure: ClinicalScanClosure): Promise<ScanClosureResourceIds>
	// CAP-020-R21, ADR-049 (doplnění D32), ADR-054 bod 3
	recordWoundTypeChange(change: ClinicalWoundTypeChange): Promise<string>
	// CAP-017-R20, ADR-050 bod 7
	publishCodeLists(set: ClinicalCodeListSet): Promise<void>
	// CAP-021-R37, ADR-050 bod 13
	recordFileResource(file: ClinicalFileResource): Promise<string>
	// CAP-021-R39, CAP-021-R36, backend.md 3.1 T7
	recordScannedDocumentPdf(document: ClinicalScannedDocumentPdf): Promise<string>

	// CAP-021-R28, backend.md 3 T4
	recordDelivery(delivery: ClinicalDelivery): Promise<string>
	// CAP-021-R37, CAP-026-R18, ADR-050 bod 11
	attachmentHashOf(binaryId: string): Promise<string>
}
