import {
	ARCHIVE_NOT_SENT_REASON,
	ARCHIVE_OUTCOME_CLASS,
	ARCHIVE_PHASE,
	ARCHIVE_RETRY_POLICY,
	ARCHIVE_TIMEOUT,
	type ArchiveClassification,
	type ArchiveNotSentReason,
	type ArchiveOutcomeClass,
	type ArchivePhase,
	type ArchiveRetryPolicy,
	type ArchiveTimeout,
} from "@ansora/vulna-domain/ports"

// integrace-dicom.md 6, ADR-003 ř. 29, ADR-017

// integrace-dicom.md 6.2
export const DIMSE_PHASE = ARCHIVE_PHASE

export type DimsePhase = ArchivePhase

// integrace-dicom.md 6.2, dorucovaci-jadro.md 5
export const NOT_SENT_REASON = ARCHIVE_NOT_SENT_REASON

export type NotSentReason = ArchiveNotSentReason

// integrace-dicom.md 6.2
export const ASSOCIATION_OUTCOME = {
	RELEASED: "released",
	RELEASED_BY_PEER: "released-by-peer",
	REJECTED: "rejected",
	ABORTED_BY_PEER: "aborted-by-peer",
	ABORTED_LOCALLY: "aborted-locally",
	CONNECT_TIMEOUT: "connect-timeout",
	SOCKET_ERROR: "socket-error",
	CLOSED_UNEXPECTEDLY: "closed-unexpectedly",
	NOT_CONNECTED: "not-connected",
} as const

export type AssociationOutcome = (typeof ASSOCIATION_OUTCOME)[keyof typeof ASSOCIATION_OUTCOME]

// integrace-dicom.md 6.2, 6.3
export const TIMEOUT_KIND = ARCHIVE_TIMEOUT

export type TimeoutKind = ArchiveTimeout

// integrace-dicom.md 6.4
export const CANCEL_REASON = {
	CALLER: "caller",
	SIGNAL: "signal",
	ITERATOR_RETURN: "iterator-return",
	MAX_MATCHES: "max-matches",
	CONSUMER_STALL: "consumer-stall",
} as const

export type CancelReason = (typeof CANCEL_REASON)[keyof typeof CANCEL_REASON]

// integrace-dicom.md 8.2, ADR-003 ř. 29
export const INFORMATION_MODEL = {
	PATIENT_ROOT: "patient-root",
	STUDY_ROOT: "study-root",
	MODALITY_WORKLIST: "modality-worklist",
} as const

export type InformationModel = (typeof INFORMATION_MODEL)[keyof typeof INFORMATION_MODEL]

// integrace-dicom.md 8, dorucovaci-jadro.md 5 (?)
export const OUTCOME_CLASS = ARCHIVE_OUTCOME_CLASS

export type OutcomeClass = ArchiveOutcomeClass

// integrace-dicom.md 8, dorucovaci-jadro.md 5
export const RETRY_POLICY = ARCHIVE_RETRY_POLICY

export type RetryPolicy = ArchiveRetryPolicy

// integrace-dicom.md 8, ADR-005 ř. 27, 29, 30, 34, CAP-023-R23
export type Classification = ArchiveClassification

// integrace-dicom.md 6.3, konfigurace-a-profily.md 2.7
export interface DimseTimeouts {
	connectMs: number
	acseMs: number
	dimseMs: number
	idleMs: number
}

// integrace-dicom.md 6.1, 6.3, 10, TS-059
export interface DimseTarget {
	host: string
	port: number
	callingAeTitle: string
	calledAeTitle: string
	maxPduLength?: number
	timeouts?: Partial<DimseTimeouts>
	queryTransferSyntaxes?: readonly string[]
}

// integrace-dicom.md 6.1, ADR-005 ř. 22, 23, CAP-023-R15
export interface StoredVariant {
	transferSyntaxUid: string
	part10: Buffer
	datasetSha256: string
}

// integrace-dicom.md 6.1, CAP-023-R15
export interface StoredArtifact {
	sopClassUid: string
	sopInstanceUid: string
	studyInstanceUid?: string
	seriesInstanceUid?: string
	variants: readonly StoredVariant[]
}

// integrace-dicom.md 6.1
export interface ProposedContext {
	abstractSyntaxUid: string
	transferSyntaxUids: readonly string[]
}

// (?)
export interface NegotiatedContext {
	id: number
	abstractSyntaxUid: string
	proposedTransferSyntaxUids: readonly string[]
	result: number
	acceptedTransferSyntaxUid: string | undefined
}

// integrace-dicom.md 8.3, PS3.8 9.3.4
export interface AssociationRejection {
	result: number
	source: number
	reason: number
}

// PS3.8 9.3.8
export interface ReceivedAbort {
	source: number
	reason: number
}

// integrace-dicom.md 6.2 (?)
export interface AssociationReport {
	outcome: AssociationOutcome
	timeout: TimeoutKind | undefined
	rejection: AssociationRejection | undefined
	abort: ReceivedAbort | undefined
	peerMaxPduLength: number | undefined
	peerImplementationClassUid: string | undefined
	peerImplementationVersionName: string | undefined
}

// integrace-dicom.md 6.2 (?)
export interface DimseTimings {
	connectedMs: number | undefined
	associatedMs: number | undefined
	respondedMs: number | undefined
	closedMs: number
}

// integrace-dicom.md 6.1 (?)
export interface EchoResult {
	phase: DimsePhase
	notSentReason: NotSentReason | undefined
	statusHex: string | undefined
	errorComment: string | undefined
	association: AssociationReport
	classification: Classification
	timingsMs: DimseTimings
}

// integrace-dicom.md 6.1
export interface CapabilityReport {
	contexts: readonly NegotiatedContext[]
	association: AssociationReport
	timingsMs: DimseTimings
}

// integrace-dicom.md 6.2
export interface StoreResult {
	phase: DimsePhase
	notSentReason: NotSentReason | undefined
	datasetBytesFlushed: number
	datasetSent: boolean
	sentDatasetSha256: string | undefined
	acceptedTransferSyntax: string | undefined
	presentationContextId: number | undefined
	statusHex: string | undefined
	errorComment: string | undefined
	association: AssociationReport
	classification: Classification
	timingsMs: DimseTimings
}

export type DicomIdentifier = Readonly<Record<string, unknown>>

// integrace-dicom.md 6.3, 6.4, konfigurace-a-profily.md 2.7
export interface FindQuery {
	informationModel: InformationModel
	identifier: DicomIdentifier
	maxMatches?: number
	highWaterMark?: number
	consumerStallMs?: number
	cancelGraceMs?: number
}

// integrace-dicom.md 6.4, CAP-024-R11
export interface FindMatch {
	statusHex: string
	identifier: DicomIdentifier
	specificCharacterSet: string | undefined
	characterSetMissing: boolean
	afterCancel: boolean
}

// integrace-dicom.md 6.4, ADR-005 ř. 39
export interface FindFinal {
	phase: DimsePhase
	notSentReason: NotSentReason | undefined
	statusHex: string | undefined
	errorComment: string | undefined
	complete: boolean
	matches: number
	matchesAfterCancel: number
	droppedAfterCancel: number
	maxQueued: number
	cancelRequested: boolean
	cancelReason: CancelReason | undefined
	association: AssociationReport
	classification: Classification
	timingsMs: DimseTimings
}

// integrace-dicom.md 6.1, ADR-003 ř. 29
export interface FindStream extends AsyncIterable<FindMatch> {
	cancel(): void
	readonly result: Promise<FindFinal>
}

// integrace-dicom.md 6, ADR-003 ř. 29, ADR-017
export interface DimseClient {
	echo(target: DimseTarget, signal?: AbortSignal): Promise<EchoResult>
	probe(target: DimseTarget, contexts: readonly ProposedContext[], signal?: AbortSignal): Promise<CapabilityReport>
	store(target: DimseTarget, artifact: StoredArtifact, signal?: AbortSignal): Promise<StoreResult>
	find(target: DimseTarget, query: FindQuery, signal?: AbortSignal): FindStream
}
