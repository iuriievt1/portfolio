import { REMOTE_FAILURE, type RemoteFailure } from "../../api/remote-failure"

export const TYPE_CHANGE = {
	IDLE: "idle",
	CONFIRMING: "confirming",
	CHANGING: "changing",
	FAILED: "failed",
} as const

export interface ChosenChange {
	previous: string
	next: string
	version: string
}

export type TypeChangeStep =
	| { kind: typeof TYPE_CHANGE.IDLE }
	| ({ kind: typeof TYPE_CHANGE.CONFIRMING; hasChangedMeanwhile: boolean } & ChosenChange)
	| ({ kind: typeof TYPE_CHANGE.CHANGING } & ChosenChange)
	| { kind: typeof TYPE_CHANGE.FAILED; failure: RemoteFailure }

export const IDLE: TypeChangeStep = { kind: TYPE_CHANGE.IDLE }

// mobile/clinical-workflow.yaml changeFindingWoundType 409, CAP-020-R21
export function stepAfterConflict(change: ChosenChange, current: string | undefined): TypeChangeStep {
	if (current === undefined) {
		return { kind: TYPE_CHANGE.FAILED, failure: REMOTE_FAILURE.SERVER_ERROR }
	}
	if (current === change.next) {
		return IDLE
	}
	return { kind: TYPE_CHANGE.CONFIRMING, ...change, previous: current, hasChangedMeanwhile: true }
}

// CAP-020-S03, E29
export function closesOnDismiss(step: TypeChangeStep): boolean {
	return step.kind === TYPE_CHANGE.FAILED && step.failure === REMOTE_FAILURE.NOT_FOUND
}
