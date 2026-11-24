import { constants } from "@veevoy/dcmjs-dimse"
import type { SessionEnd } from "./association-session"
import {
	ASSOCIATION_OUTCOME,
	type AssociationRejection,
	DIMSE_PHASE,
	type DimsePhase,
	NOT_SENT_REASON,
	type NotSentReason,
} from "./contract"

// integrace-dicom.md 6.2, 8.1, 8.3, dorucovaci-jadro.md 5
const CONNECT_FAILURES: ReadonlySet<string> = new Set([
	ASSOCIATION_OUTCOME.NOT_CONNECTED,
	ASSOCIATION_OUTCOME.CONNECT_TIMEOUT,
])

export interface Answer {
	status: number | undefined
	errorComment: string | undefined
	forkNotSentReason: string | undefined
}

// integrace-dicom.md 6.2
export interface Attempt {
	phase: DimsePhase
	notSentReason: NotSentReason | undefined
	status: number | undefined
	statusHex: string | undefined
	errorComment: string | undefined
	rejection: AssociationRejection | undefined
}

export function noAnswer(): Answer {
	return { status: undefined, errorComment: undefined, forkNotSentReason: undefined }
}

// integrace-dicom.md 6.2, 8.1, 8.3, dorucovaci-jadro.md 5
export function notSentReasonOf(end: SessionEnd, forkNotSentReason: string | undefined): NotSentReason {
	switch (forkNotSentReason) {
		case constants.NotSentReason.NoAcceptedPresentationContext:
			return NOT_SENT_REASON.NO_ACCEPTED_TRANSFER_SYNTAX
		case constants.NotSentReason.StoredDatasetUnavailable:
		case constants.NotSentReason.TransferSyntaxMismatch:
			return NOT_SENT_REASON.ARTIFACT_INTEGRITY
		case constants.NotSentReason.CharacterSetMismatch:
			return NOT_SENT_REASON.INVALID_QUERY
		default:
			break
	}
	if (end.association.outcome === ASSOCIATION_OUTCOME.REJECTED) {
		return NOT_SENT_REASON.ASSOCIATION_REJECTED
	}
	// dorucovaci-jadro.md 5 (?)
	if (end.abortedByUs) {
		return NOT_SENT_REASON.ABORTED_BEFORE_CONNECT
	}
	if (CONNECT_FAILURES.has(end.association.outcome)) {
		return NOT_SENT_REASON.CONNECT_FAILED
	}
	return NOT_SENT_REASON.CLOSED_BEFORE_DATA
}

// integrace-dicom.md 6.2, 8.2, 8.3, ADR-005 ř. 33
export function phaseOf(isAnswered: boolean, bytesSent: number): DimsePhase {
	if (isAnswered) {
		return DIMSE_PHASE.RESPONSE
	}
	return bytesSent > 0 ? DIMSE_PHASE.UNKNOWN : DIMSE_PHASE.NOT_SENT
}

// integrace-dicom.md 6.2
export function statusHexOf(status: number): string {
	return status.toString(16).toUpperCase().padStart(4, "0")
}

export function errorCommentOf(errorComment: string | undefined): string | undefined {
	return errorComment === undefined || errorComment.length === 0 ? undefined : errorComment
}

// integrace-dicom.md 6.2, 8
export function attemptOf(end: SessionEnd, answer: Answer, bytesSent: number): Attempt {
	const phase = phaseOf(answer.status !== undefined, bytesSent)
	return {
		phase,
		notSentReason: phase === DIMSE_PHASE.NOT_SENT ? notSentReasonOf(end, answer.forkNotSentReason) : undefined,
		status: answer.status,
		statusHex: answer.status === undefined ? undefined : statusHexOf(answer.status),
		errorComment: answer.errorComment,
		rejection: end.association.rejection,
	}
}

// integrace-dicom.md 6.2
export function unsentAttempt(notSentReason: NotSentReason): Attempt {
	return {
		phase: DIMSE_PHASE.NOT_SENT,
		notSentReason,
		status: undefined,
		statusHex: undefined,
		errorComment: undefined,
		rejection: undefined,
	}
}
