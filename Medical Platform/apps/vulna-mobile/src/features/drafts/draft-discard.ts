import { DISCARD_SITUATION, type DiscardSituation, ERROR_CODE } from "@ansora/contracts"
import type { AcquisitionDraft } from "../../api/acquisitions"
import { errorCodeOf } from "../../api/api-error"
import { isNotFound, type RemoteFailure, remoteFailureOf } from "../../api/remote-failure"

export const DRAFT_DISCARD = {
	IDLE: "idle",
	PREPARING: "preparing",
	CONFIRMING: "confirming",
	DISCARDING: "discarding",
	CHANGED: "changed",
	FAILED: "failed",
} as const

export type DraftDiscard =
	| { kind: typeof DRAFT_DISCARD.IDLE }
	| { kind: typeof DRAFT_DISCARD.PREPARING }
	| { kind: typeof DRAFT_DISCARD.CONFIRMING; draft: AcquisitionDraft }
	| { kind: typeof DRAFT_DISCARD.DISCARDING; draft: AcquisitionDraft }
	| { kind: typeof DRAFT_DISCARD.CHANGED }
	| { kind: typeof DRAFT_DISCARD.FAILED; failure: RemoteFailure }

const DECIDED_ELSEWHERE: ReadonlySet<string | undefined> = new Set([
	ERROR_CODE.ACQUISITION_VERSION_CONFLICT,
	ERROR_CODE.ACQUISITION_CLOSED,
])

// CAP-025-R20, CAP-015-R16
export function ownDraftsSituationOf(requested: string | undefined): DiscardSituation {
	return requested === DISCARD_SITUATION.LOGOUT ? DISCARD_SITUATION.LOGOUT : DISCARD_SITUATION.EXPLICIT_DISCARD
}

// CAP-021-R32, CAP-015-S41, E115
export function discardStateOfError(error: unknown): DraftDiscard {
	if (DECIDED_ELSEWHERE.has(errorCodeOf(error)) || isNotFound(error)) {
		return { kind: DRAFT_DISCARD.CHANGED }
	}
	return { kind: DRAFT_DISCARD.FAILED, failure: remoteFailureOf(error) }
}
