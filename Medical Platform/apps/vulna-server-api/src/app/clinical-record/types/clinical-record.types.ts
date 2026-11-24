import type { ClaimedQueueTask, DurableBinaryLinkPort, JOB_OBJECT_KIND } from "@ansora/core-server"
import type {
	BodySite,
	ClinicalArchivedFile,
	ClinicalCodeListSet,
	ClinicalFileContent,
	ClinicalFileRendition,
	ClinicalFileResource,
	ClinicalRecordStorePort,
	ClinicalScannedDocumentPdf,
	ClinicalStation,
	ClosedSeries,
	ImageHistoryPort,
} from "@ansora/vulna-domain"
import type { ARTIFACT_SOURCE_KIND } from "../constants/clinical-record.constants"

export type WriteTaskObjectKind = (typeof JOB_OBJECT_KIND)[
	| "ACTOR"
	| "CODE_LIST_SET"
	| "IMAGE"
	| "DOCUMENT_PAGE"
	| "DOCUMENT"
	| "ACQUISITION"]

// datovy-model.md 4, CAP-021-R31
export type ClaimedWriteTask = Omit<ClaimedQueueTask<WriteTaskObjectKind>, "objectKind">

export type FileResourceObjectKind = (typeof JOB_OBJECT_KIND)["IMAGE" | "DOCUMENT_PAGE"]

export interface ActorRow {
	display_name: string
	department_id: string | null
	department_code: string | null
}

export interface ActorRoleRow {
	role: string
}

export interface ClinicalPatientRow {
	id: string
	family_name: string | null
	given_name: string | null
	birth_date: string | null
	sex: "male" | "female" | "other" | null
	demographics_revision: number
}

export interface ClinicalIdentifierRow {
	system: string
	value: string
	issuer: string | null
	valid_until: Date | null
}

// datovy-model.md 13.2
export interface ResourceLink {
	resourceType: string
	localKind: string
	localId: string
	resourceId: string
}

// CAP-015-R17, CAP-015-R30, CAP-020-R16, ADR-054 bod 2
export interface RecordVisibility {
	userId: string
	closedAcquisitionIds: readonly string[]
}

// konfigurace-a-profily.md 2.1
export interface StoreConnection {
	baseUrl: string
	instanceBaseUri: string
	clientId: string
	// ADR-053 (doplnění 2026-09-24) bod 1
	storageUrl: string | undefined
}

export interface ConnectedStore extends StoreConnection {
	store: ClinicalRecordStorePort
	// ADR-054 bod 2
	history: ImageHistoryPort
	links: DurableBinaryLinkPort
}

// CAP-016-R17, CAP-020-R13
export interface FindingOwner {
	findingId: string
	acquisitionId: string
	patientId: string
	departmentId: string | null
}

// CAP-017-R02, CAP-020-R19
export interface DraftWoundTypeRecord extends FindingOwner {
	woundTypeCode: string
}

// CAP-020-R21, CAP-025-R30
export interface WoundTypeChangeRecord {
	changeId: string
	findingId: string
	patientId: string
	departmentId: string | null
	woundTypeCode: string
	changedAt: Date
	changedBy: string
}

// CAP-017-R03, CAP-017-R04
export interface DraftAssessmentRecord extends FindingOwner {
	bodyDiagramVersion: string
	// CAP-017-R16, CHG-181
	healingPhaseCode: string | undefined
	description: string | null
}

// CAP-016-R17, CAP-020-R13
export interface DraftFindingRecord extends FindingOwner {
	site: BodySite
}

// ADR-050 (doplnění D33) bod 3, ADR-050 bod 10
export interface WithdrawnFindingRecord extends DraftFindingRecord {
	woundTypeCode: string | null
}

// CAP-021-R39
export interface DraftDocumentRecord {
	documentId: string
	acquisitionId: string
	departmentId: string | null
}

// CAP-021-R39, CAP-021-R28, ADR-050 (doplnění D33) bod 1
export interface FoundedDocumentRecord extends DraftDocumentRecord {
	patientId: string
	encounter: ClosedEncounter
	series: ClosedSeries
}

// ADR-050 (doplnění D33) bod 3
export interface StudySeriesRecord {
	encounterId: string
	seriesInstanceUid: string
}

// ADR-050 (doplnění D33) bod 3, CAP-015-R17, CAP-014-R25
export interface WithdrawnDocumentRecord extends DraftDocumentRecord {
	series: StudySeriesRecord | undefined
}

export interface ClosingDeviceRow {
	id: string
	model: string
}

// ADR-050, integrace-dicom.md 5.9
export interface ClosedEncounter {
	id: string
	studyInstanceUid: string
	startedAt: Date | null
	departmentId: string | null
}

// CAP-021-R13, CAP-021-R27, ADR-050
export interface ClosedRecord {
	acquisitionId: string
	patientId: string
	departmentId: string | null
	operatorUserId: string
	station: ClinicalStation
	startedAt: Date
	closedAt: Date
	encounter: ClosedEncounter
	series: ClosedSeries
}

// ADR-050, CAP-020-R21
export interface ClosedWoundRecord extends ClosedRecord {
	findingId: string
	isFirstRecordOfFinding: boolean
	site: BodySite
	// CAP-017-R16, CHG-181
	woundTypeCode: string | undefined
	healingPhaseCode: string | undefined
	description: string | null
}

// ADR-050, CAP-018-R15, CAP-021-R39
export interface ClosedScanRecord extends ClosedRecord {
	documentId: string
	titleCode: string | null
	titleText: string | null
	pageCount: number
}

// CAP-017-R20
export interface CodeListPublication {
	version: number
	content: ClinicalCodeListSet
}

// datovy-model.md 4 „Binární objekt“, CAP-021-R36
export interface FileRenditionRow {
	binary_object_id: string
	size_bytes: number
	sha256: string
	clinical_record_binary_id: string | null
	clinical_record_uploaded_at: string | null
	buffer_deleted_at: string | null
	// CAP-026-R19, ADR-050 bod 14
	retention_due_at: string | null
}

// CAP-021-R36, CAP-021-R37
export interface ConfirmedRenditionRow extends FileRenditionRow {
	clinical_record_binary_id: string
	clinical_record_uploaded_at: string
}

// CAP-021-R39, backend.md 3.1 T7
export interface ScannedDocumentRow {
	document_id: string
	acquisition_id: string
	patient_id: string
	encounter_id: string
	department_id: string | null
	operator_user_id: string
	closed_at: Date | null
	page_count: number | null
	title_code: string | null
	title_text: string | null
	series_instance_uid: string
	pdf: FileRenditionRow | null
	// CAP-026-R20
	output_pdf_deleted_at: Date | null
	// integrace-dicom.md 5.9, CAP-021-R28
	delivered_sop_instance_uid: string | null
	delivered_title: string | null
	delivered_language: string | null
	delivered_created_at: Date | null
}

// CAP-021-R39
// CAP-021-R37, CAP-026-R19, CAP-026-R20
export type KeptOrArchived = ConfirmedRenditionRow | ClinicalArchivedFile

export interface ScannedDocumentDraft {
	document: Omit<ClinicalScannedDocumentPdf, "pdf">
	pdf: KeptOrArchived
	detaching: readonly string[]
}

// CAP-021-R37, ADR-050 bod 13
export interface FileRenditions<Original, Rendition> {
	original: Original
	thumbnail: Rendition | undefined
	viewingCopy: Rendition | undefined
}

// CAP-021-R37, ADR-050 bod 13
export type FileResourceBase = Omit<
	ClinicalFileResource,
	"kind" | keyof FileRenditions<ClinicalFileContent, ClinicalFileRendition>
>

// CAP-021-R37, CAP-026-R19
export interface FileResourceDraft {
	renditions: FileRenditions<KeptOrArchived, ConfirmedRenditionRow>
	detaching: readonly string[]
	resourceWith: (renditions: FileRenditions<ClinicalFileContent, ClinicalFileRendition>) => ClinicalFileResource
}

// CAP-026-R19, CAP-026-R20, ADR-050 bod 14
export interface ResourceWrite<Resource> {
	resource: Resource
	detaching: readonly string[]
}

// CAP-021-R37, ADR-050 bod 13
export interface FileResourceRow {
	file_id: string
	acquisition_id: string
	sequence: number
	patient_id: string
	encounter_id: string
	department_id: string | null
	finding_id: string | null
	document_id: string | null
	series_instance_uid: string
	// integrace-dicom.md 5.9, CAP-021-R28
	sop_instance_uid: string | null
	original: FileRenditionRow | null
	thumbnail: FileRenditionRow | null
	viewing_copy: FileRenditionRow | null
	// CAP-026-R06, CAP-026-R19
	file_sha256: string | null
	original_deleted_at: Date | null
}

// CAP-021-R28, backend.md 3 T4
export interface DeliveredRecordRow {
	acquisition_id: string
	patient_id: string
	encounter_id: string
}

// integrace-dicom.md 5.4, 5.9, CAP-021-R28
export type ArtifactSourceKind = (typeof ARTIFACT_SOURCE_KIND)[keyof typeof ARTIFACT_SOURCE_KIND]

export interface DeliveredInstanceRow {
	acquisition_id: string
	source_kind: ArtifactSourceKind
	sop_class_uid: string
	sop_instance_uid: string
	instance_title_written: string | null
	instance_description_written: string | null
	series_description_written: string | null
	instance_created_at: Date | null
	retention_anchor: Date
	series_instance_uid: string
	instance_number: number
}
