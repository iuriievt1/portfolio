import { SIGN_OUT_OUTCOME, type SignOutOutcome } from "@ansora/core-mobile"
import type { AcquisitionDraftSummary } from "../../api/acquisitions"
import { REMOTE_FAILURE, remoteFailureOf } from "../../api/remote-failure"

export const SIGN_OUT_STATE = {
	IDLE: "idle",
	CHECKING: "checking",
	UNCLOSED_DRAFT: "unclosed_draft",
	UNCLOSED_DRAFTS: "unclosed_drafts",
	FILES_UPLOADING: "files_uploading",
	CLOSING_QUEUED: "closing_queued",
	SIGNING_OUT: "signing_out",
	OFFLINE: "offline",
	REJECTED: "rejected",
} as const

export type SignOutState =
	| { kind: typeof SIGN_OUT_STATE.IDLE }
	| { kind: typeof SIGN_OUT_STATE.CHECKING }
	| { kind: typeof SIGN_OUT_STATE.UNCLOSED_DRAFT; draft: AcquisitionDraftSummary }
	| { kind: typeof SIGN_OUT_STATE.UNCLOSED_DRAFTS; count: number }
	| { kind: typeof SIGN_OUT_STATE.FILES_UPLOADING; count: number; isClosingQueued: boolean }
	| { kind: typeof SIGN_OUT_STATE.CLOSING_QUEUED }
	| { kind: typeof SIGN_OUT_STATE.SIGNING_OUT }
	| { kind: typeof SIGN_OUT_STATE.OFFLINE }
	| { kind: typeof SIGN_OUT_STATE.REJECTED }

export const SIGN_OUT = {
	IDLE: { kind: SIGN_OUT_STATE.IDLE },
	CHECKING: { kind: SIGN_OUT_STATE.CHECKING },
	SIGNING_OUT: { kind: SIGN_OUT_STATE.SIGNING_OUT },
	CLOSING_QUEUED: { kind: SIGN_OUT_STATE.CLOSING_QUEUED },
	OFFLINE: { kind: SIGN_OUT_STATE.OFFLINE },
	REJECTED: { kind: SIGN_OUT_STATE.REJECTED },
} as const satisfies Record<string, SignOutState>

// CAP-015-R16, CAP-019-R29, E40
export function unconfirmedDraftsOf(
	drafts: readonly AcquisitionDraftSummary[],
	queuedClosureIds: ReadonlySet<string>,
): AcquisitionDraftSummary[] {
	return drafts.filter((draft) => !queuedClosureIds.has(draft.acquisition_id))
}

// CAP-015-R16, CAP-015-S09, E40
export function unclosedDraftStateOf(drafts: readonly AcquisitionDraftSummary[]): SignOutState | undefined {
	const [first] = drafts
	if (first === undefined) {
		return undefined
	}
	return drafts.length === 1
		? { kind: SIGN_OUT_STATE.UNCLOSED_DRAFT, draft: first }
		: { kind: SIGN_OUT_STATE.UNCLOSED_DRAFTS, count: drafts.length }
}

// CAP-002-R14, CAP-002-S12, CAP-019-R29, CAP-019-S21, E9, E53
export function waitingStateOf(
	awaitingFileCount: number,
	isClosingQueued: boolean,
	isClosingAccepted: boolean,
): SignOutState | undefined {
	if (awaitingFileCount > 0) {
		return { kind: SIGN_OUT_STATE.FILES_UPLOADING, count: awaitingFileCount, isClosingQueued }
	}
	return isClosingQueued && !isClosingAccepted ? SIGN_OUT.CLOSING_QUEUED : undefined
}

// CAP-002-R17
export function checkFailureStateOf(error: unknown): SignOutState {
	return remoteFailureOf(error) === REMOTE_FAILURE.NO_CONNECTION ? SIGN_OUT.OFFLINE : SIGN_OUT.REJECTED
}

export function signOutStateOf(outcome: SignOutOutcome): SignOutState {
	switch (outcome.kind) {
		case SIGN_OUT_OUTCOME.SIGNED_OUT:
			return SIGN_OUT.IDLE
		case SIGN_OUT_OUTCOME.NO_CONNECTION:
			return SIGN_OUT.OFFLINE
		case SIGN_OUT_OUTCOME.REJECTED:
			return SIGN_OUT.REJECTED
		default:
			return outcome satisfies never
	}
}
