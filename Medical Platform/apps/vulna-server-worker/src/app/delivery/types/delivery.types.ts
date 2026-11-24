import type { AdministratorAlertKind, DeliveryInstanceState, HeldForReviewCause } from "@ansora/contracts"
import type { ClaimedQueueTask, JOB_OBJECT_KIND } from "@ansora/core-server"
import type { DimseSettings } from "@ansora/vulna-adapter-dicom-dimse"
import type {
	ArchiveExchange,
	ArchiveQueryOutcome,
	DocumentArchivePort,
	ImageArchivePort,
	QueryResult,
	RetryBackoff,
	StudyQueryResult,
} from "@ansora/vulna-domain"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"
import type { ArtifactSourceKind } from "../../../libs/common/constants/artifact.constants"
import type { TARGET_CHANGE, TASK_ACTION, VERIFICATION_LEVEL } from "../constants/delivery.constants"

export type DeliveryObjectKind = typeof JOB_OBJECT_KIND.DELIVERY_INSTANCE

export type ClaimedDeliveryTask = ClaimedQueueTask<DeliveryObjectKind>

export type VerificationLevel = (typeof VERIFICATION_LEVEL)[keyof typeof VERIFICATION_LEVEL]

export type DeliveryArchive = ImageArchivePort & DocumentArchivePort

export type DeliveryArchiveFactory = (settings: DimseSettings) => DeliveryArchive

// ADR-005 ř. 23, CAP-023-R15, integrace-dicom.md 3
export interface TransferSyntaxPreference {
	image: readonly string[]
	document: readonly string[]
}

// konfigurace-a-profily.md 2.7, CAP-023-R10, CAP-023-R26, CAP-023-R27
export interface DeliverySettings {
	archive: DeliveryArchive
	maxAttempts: number
	backoff: RetryBackoff
	verificationDelaySeconds: number
	rejectionsBeforeAlert: number
	unavailableAlertSeconds: number
	transferSyntaxPreference: TransferSyntaxPreference
}

// datovy-model.md 4 „Doručení“, „Artefakt“
export interface DeliveryInstanceRow {
	id: string
	delivery_id: string
	state: DeliveryInstanceState
	attempts: number
	verification_rejections: number
	artifact_id: string
	source_kind: ArtifactSourceKind
	sop_class_uid: string
	sop_instance_uid: string
	acquisition_id: string
	target: string
	study_instance_uid: string
	series_instance_uid: string
}

export interface DeliveryInstance {
	id: string
	deliveryId: string
	state: DeliveryInstanceState
	attempts: number
	verificationRejections: number
	artifactId: string
	sourceKind: ArtifactSourceKind
	sopClassUid: string
	sopInstanceUid: string
	acquisitionId: string
	targetCode: string
	studyInstanceUid: string
	seriesInstanceUid: string
}

// datovy-model.md 4 „Artefakt“, ADR-005 ř. 22, 23
export interface StoredVariantRow {
	transfer_syntax: string
	dataset_sha256: string
	binary_object_id: string
}

// datovy-model.md 4 „Doručení“
export interface InstanceTransition {
	from: DeliveryInstanceState
	to: DeliveryInstanceState
	countedAttempts: number
	statusHex: string | undefined
	acceptedTransferSyntax: string | undefined
	heldForReviewCause: HeldForReviewCause | undefined
	verificationRejections: number
	isOnHold: boolean
}

export type TaskAction =
	| { kind: typeof TASK_ACTION.COMPLETE }
	| { kind: typeof TASK_ACTION.FAIL }
	| { kind: typeof TASK_ACTION.WAIT; delayMilliseconds: number }

// dorucovaci-jadro.md 5.3
export interface TargetChange {
	kind: (typeof TARGET_CHANGE)[keyof typeof TARGET_CHANGE]
	exchange: ArchiveExchange
}

export interface InstanceAlert {
	kind: AdministratorAlertKind
	message: string
}

// dorucovaci-jadro.md 5, 5.1, 5.3, 5.4
export interface DeliveryStep {
	transition: InstanceTransition
	target: TargetChange | undefined
	alert: InstanceAlert | undefined
	task: TaskAction
	events: SystemJobAuditEvent[]
}

export interface ImageVerification {
	outcome: ArchiveQueryOutcome
	result: QueryResult
}

export interface StudyVerification {
	outcome: ArchiveQueryOutcome
	result: StudyQueryResult
}

// CAP-023-R09, CAP-023-R13, CAP-023-R26
export interface Verification {
	image: ImageVerification
	study: StudyVerification | undefined
}

// datovy-model.md 4 „Cíl doručení“
export interface UnavailableTargetRow {
	code: string
	changed_at: Date
}

// CAP-021-R28, backend.md 3 T4
export interface DeliverySettlementRow {
	is_settled: boolean | null
	has_confirmed: boolean | null
	is_assembly_over: boolean | null
}

// CAP-021-R37, CAP-021-R39, backend.md 3 T4b
export interface UploadedFileRow {
	kind: typeof JOB_OBJECT_KIND.IMAGE | typeof JOB_OBJECT_KIND.DOCUMENT_PAGE | typeof JOB_OBJECT_KIND.DOCUMENT
	id: string
	is_uploaded: boolean
}

export interface AlertedInstance {
	deliveryId: string
	instanceId: string
}
