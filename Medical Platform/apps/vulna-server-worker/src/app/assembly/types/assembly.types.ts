import type { AcquisitionKind, DeliveryState } from "@ansora/contracts"
import type { ClaimedQueueTask, JOB_OBJECT_KIND } from "@ansora/core-server"
import type {
	ClosedRecordReaderPort,
	ClosedSeries,
	DicomOperator,
	DicomPatientSource,
	EditKind,
	StudyEncounter,
} from "@ansora/vulna-domain"
import type { ArtifactVariant, ImplementationIdentity, TransferSyntax } from "@ansora/vulna-projection-dicom"
import type { BinaryObject } from "../../../libs/binary-store/binary-object"
import type { ArtifactSourceKind } from "../../../libs/common/constants/artifact.constants"
import type { ASSEMBLY_FAILURE, ASSEMBLY_PAUSE, TEXT_RECOGNITION_FAILURE_CLASS } from "../constants/assembly.constants"

export type AssemblyObjectKind = typeof JOB_OBJECT_KIND.ACQUISITION

export type ClaimedAssemblyTask = ClaimedQueueTask<AssemblyObjectKind>

export type AssemblyFailureReason = (typeof ASSEMBLY_FAILURE)[keyof typeof ASSEMBLY_FAILURE]

export type AssemblyPause = (typeof ASSEMBLY_PAUSE)[keyof typeof ASSEMBLY_PAUSE]

export type TextRecognitionFailureClass =
	(typeof TEXT_RECOGNITION_FAILURE_CLASS)[keyof typeof TEXT_RECOGNITION_FAILURE_CLASS]

// CAP-021-R17, CAP-012-R17, CAP-021-R26, integrace-dicom.md 3, 4, 5.0, 5.1, 5.7, 5.8
export interface AssemblySettings {
	imageTransferSyntaxes: readonly TransferSyntax[]
	documentTransferSyntaxes: readonly TransferSyntax[]
	identity: ImplementationIdentity
	language: string
	softwareVersion: string
	patientIdSystem: string
	reader: ClosedRecordReaderPort
}

// ADR-054 bod 4, CAP-012-R30
export interface ReaderConnection {
	baseUrl: string
	instanceBaseUri: string
	canonicalBase: string
	clientId: string
}

export interface ConnectedReader extends ReaderConnection {
	reader: ClosedRecordReaderPort
}

// datovy-model.md 4 „Doručení“
export interface AssemblyDelivery {
	id: string
	state: DeliveryState
}

// integrace-dicom.md 2, 5, datovy-model.md 4 „Pořízení“
export interface FoundRecord {
	acquisitionId: string
	kind: AcquisitionKind
	startedAt: Date
	fileCount: number | undefined
	firstInstanceNumber: number | undefined
	findingId: string | undefined
	woundNumber: number | undefined
	documentId: string | undefined
	operator: DicomOperator
	closingHardwareId: string | undefined
	encounter: StudyEncounter
	series: ClosedSeries | undefined
	patient: DicomPatientSource
	patientResourceId: string | undefined
	delivery: AssemblyDelivery | undefined
}

// CAP-021-R03
export interface AssemblyRecord extends FoundRecord {
	delivery: AssemblyDelivery
}

export interface AssemblyRecordRow {
	id: string
	kind: AcquisitionKind
	patient_id: string
	started_at: Date
	file_count: number | null
	first_instance_number: number | null
	finding_id: string | null
	wound_number: number | null
	document_id: string | null
	operator_family_name: string
	operator_given_name: string
	closing_hardware_id: string | null
	study_instance_uid: string
	study_id: string
	accession_number: string | null
	encounter_date: string
	encounter_started_at: Date | null
	series_instance_uid: string | null
	series_number: number | null
	family_name: string | null
	given_name: string | null
	birth_date: string | null
	sex: DicomPatientSource["sex"] | null
	patient_resource_id: string | null
	delivery_id: string | null
	delivery_state: DeliveryState | null
}

export interface PatientIdentifierRow {
	system: string
	value: string
	issuer: string | null
	valid_until: Date | null
}

// CAP-021-R25, CAP-015-R33, CAP-021-R34
export interface AssemblyImage {
	imageId: string
	sequence: number
	binaryObjectId: string
	editKind: EditKind | undefined
}

export interface AssemblyImageRow {
	id: string
	sequence: number
	binary_object_id: string
	edit_kind: EditKind | null
}

// integrace-dicom.md 5.4
export interface InstanceOfFile {
	sopInstanceUid: string
	sequence: number
}

// datovy-model.md 4 „Artefakt“, 11
export interface ReservedArtifact {
	artifactId: string
	sopInstanceUid: string
}

export interface ArtifactSource {
	sourceKind: ArtifactSourceKind
	sourceId: string
	sopClassUid: string
}

// integrace-dicom.md 5.8, 5.9, datovy-model.md 13.2
export interface WrittenTexts {
	language: string
	seriesDescription: string | undefined
	instanceTitle: string | undefined
	instanceDescription: string | undefined
}

// dorucovaci-jadro.md 3, CAP-021-R06
export interface BuiltArtifact {
	artifactId: string
	variants: readonly ArtifactVariant[]
	texts: WrittenTexts
	// integrace-dicom.md 5.9 pravidlo 1, Instance Creation Date/Time
	instanceCreatedAt: Date
}

export interface StoredVariant {
	transferSyntax: TransferSyntax
	datasetSha256: string
	object: BinaryObject
}

export interface StoredArtifact {
	artifactId: string
	variants: readonly StoredVariant[]
	texts: WrittenTexts
	instanceCreatedAt: Date
}

export interface CodeListNameRow {
	language: string
	name: string
}

// CAP-022-R11, CAP-028-R15
export interface FailedAssembly {
	acquisitionId: string
	deliveryId: string
	reason: AssemblyFailureReason
}

export interface RaisedAssemblyAlert {
	alertId: string
	taskId: string
	message: string
	failure: FailedAssembly
}
