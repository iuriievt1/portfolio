// integrace-dicom.md 6.2, ADR-017
export const ARCHIVE_PHASE = {
	NOT_SENT: "not-sent",
	RESPONSE: "response",
	UNKNOWN: "unknown",
} as const

export type ArchivePhase = (typeof ARCHIVE_PHASE)[keyof typeof ARCHIVE_PHASE]

// integrace-dicom.md 6.2, dorucovaci-jadro.md 5
export const ARCHIVE_NOT_SENT_REASON = {
	ABORTED_BEFORE_CONNECT: "aborted-before-connect",
	CONNECT_FAILED: "connect-failed",
	ASSOCIATION_REJECTED: "association-rejected",
	NO_ACCEPTED_TRANSFER_SYNTAX: "no-accepted-transfer-syntax",
	CLOSED_BEFORE_DATA: "closed-before-data",
	ARTIFACT_INTEGRITY: "artifact-integrity",
	// (?)
	INVALID_QUERY: "invalid-query",
} as const

export type ArchiveNotSentReason = (typeof ARCHIVE_NOT_SENT_REASON)[keyof typeof ARCHIVE_NOT_SENT_REASON]

// integrace-dicom.md 6.2, 6.3
export const ARCHIVE_TIMEOUT = {
	CONNECT: "connect",
	ACSE: "acse",
	DIMSE: "dimse",
	IDLE: "idle",
} as const

export type ArchiveTimeout = (typeof ARCHIVE_TIMEOUT)[keyof typeof ARCHIVE_TIMEOUT]

// integrace-dicom.md 8, dorucovaci-jadro.md 5
export const ARCHIVE_OUTCOME_CLASS = {
	SUCCESS: "success",
	SUCCESS_WITH_WARNING: "success-with-warning",
	TRANSIENT: "transient",
	CONFIGURATION: "configuration",
	DATA: "data",
	IDENTITY_CONFLICT: "identity-conflict",
	UNKNOWN_OUTCOME: "unknown-outcome",
	UNDOCUMENTED_STATUS: "undocumented-status",
	INCOMPLETE_RESULT: "incomplete-result",
} as const

export type ArchiveOutcomeClass = (typeof ARCHIVE_OUTCOME_CLASS)[keyof typeof ARCHIVE_OUTCOME_CLASS]

// integrace-dicom.md 8, dorucovaci-jadro.md 5
export const ARCHIVE_RETRY_POLICY = {
	NEVER: "never",
	BACKOFF: "backoff",
	VERIFY_THEN_RETRY: "verify-then-retry",
} as const

export type ArchiveRetryPolicy = (typeof ARCHIVE_RETRY_POLICY)[keyof typeof ARCHIVE_RETRY_POLICY]

// integrace-dicom.md 8, ADR-003 ř. 27
export interface ArchiveClassification {
	outcomeClass: ArchiveOutcomeClass
	retryPolicy: ArchiveRetryPolicy
	retentionAnchor: boolean
	clinicalSafetyQueue: boolean
	alertAdmin: boolean
	pauseTarget: boolean
	ruleId: string
}

// integrace-dicom.md 6.2
export interface ArchiveExchange {
	phase: ArchivePhase
	notSentReason: ArchiveNotSentReason | undefined
	timeout: ArchiveTimeout | undefined
	statusHex: string | undefined
	errorComment: string | undefined
	classification: ArchiveClassification
}

// integrace-dicom.md 6.2, CAP-023-R15
export interface ArchiveStoreOutcome extends ArchiveExchange {
	acceptedTransferSyntax: string | undefined
}

// integrace-dicom.md 6.4, 9, CAP-023-R13
export interface ArchiveQueryOutcome extends ArchiveExchange {
	isComplete: boolean
	matchedValues: readonly string[]
}

// integrace-dicom.md 6.1, ADR-005 ř. 22, 23, CAP-023-R15
export interface DeliverableVariant {
	transferSyntaxUid: string
	part10: Uint8Array
	datasetSha256: string
}

// integrace-dicom.md 6.1, CAP-023-R15
export interface DeliverableArtifact {
	sopClassUid: string
	sopInstanceUid: string
	studyInstanceUid: string
	seriesInstanceUid: string
	variants: readonly DeliverableVariant[]
}

// integrace-dicom.md 9, CAP-023-R13
export interface ArchivedInstance {
	studyInstanceUid: string
	seriesInstanceUid: string
	sopInstanceUid: string
}
