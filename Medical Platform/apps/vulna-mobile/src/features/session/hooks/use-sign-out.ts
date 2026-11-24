import { DISCARD_SITUATION } from "@ansora/contracts"
import { NoSessionError } from "@ansora/core-mobile"
import { useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"
import type { AcquisitionDraft, AcquisitionDraftSummary } from "../../../api/acquisitions"
import { DRAFT_DISCARD, type DraftDiscard } from "../../drafts/draft-discard"
import { useDraftDiscard } from "../../drafts/hooks/use-draft-discard"
import { readOwnDrafts } from "../../drafts/own-drafts"
import { queuedClosureIdsOf } from "../../upload/closure-queue"
import { readOwnAwaitingFileCount } from "../../upload/own-uploads"
import { sessionCaller, signOutOfApp } from "../session-actions"
import { currentSession } from "../session-store"
import { awaitClosingBeforeSignOut, takeResumedSignOut } from "../sign-out-resume"
import {
	checkFailureStateOf,
	SIGN_OUT,
	SIGN_OUT_STATE,
	type SignOutState,
	signOutStateOf,
	unclosedDraftStateOf,
	unconfirmedDraftsOf,
	waitingStateOf,
} from "../sign-out-state"

const BUSY_STATES: ReadonlySet<SignOutState["kind"]> = new Set([SIGN_OUT_STATE.CHECKING, SIGN_OUT_STATE.SIGNING_OUT])
const BUSY_DISCARDS: ReadonlySet<DraftDiscard["kind"]> = new Set([DRAFT_DISCARD.PREPARING, DRAFT_DISCARD.DISCARDING])

export interface SignOutFlow {
	state: SignOutState
	discard: DraftDiscard
	isBusy: boolean
	signOut: () => void
	leave: () => void
	leaveWithQueuedClosing: () => void
	closeThroughSummary: (draft: AcquisitionDraftSummary) => void
	discardDraft: (draft: AcquisitionDraftSummary) => void
	confirmDiscard: (draft: AcquisitionDraft) => void
	dismissDiscard: () => void
	dismiss: () => void
}

// CAP-015-R16, CAP-019-R29, E40
async function readUnconfirmedDrafts(sessionToken: string): Promise<AcquisitionDraftSummary[]> {
	const drafts = await readOwnDrafts(sessionToken)
	const userId = currentSession()?.user.id
	if (userId === undefined) {
		return drafts
	}
	return unconfirmedDraftsOf(drafts, await queuedClosureIdsOf(userId))
}

// CAP-002-S02, CAP-002-R14, CAP-015-R16, CAP-015-S09
export function useSignOut(): SignOutFlow {
	const [state, setState] = useState<SignOutState>(SIGN_OUT.IDLE)

	// CAP-002-R14, CAP-002-S12, CAP-002-S13, CAP-019-S21
	const leave = useCallback(async (isClosingAccepted: boolean) => {
		const userId = currentSession()?.user.id
		if (userId === undefined) {
			setState(SIGN_OUT.IDLE)
			return
		}
		setState(SIGN_OUT.CHECKING)
		try {
			const isClosingQueued = (await queuedClosureIdsOf(userId)).size > 0
			const waiting = waitingStateOf(await readOwnAwaitingFileCount(userId), isClosingQueued, isClosingAccepted)
			if (waiting !== undefined) {
				setState(waiting)
				return
			}
			setState(SIGN_OUT.SIGNING_OUT)
			setState(signOutStateOf(await signOutOfApp()))
		} catch (error) {
			if (error instanceof NoSessionError) {
				setState(SIGN_OUT.IDLE)
				return
			}
			console.warn("the sign-out failed", error)
			setState(SIGN_OUT.REJECTED)
		}
	}, [])

	// CAP-015-R16, CAP-019-R29, E40
	const checkDrafts = useCallback(async () => {
		setState(SIGN_OUT.CHECKING)
		try {
			const unclosed = unclosedDraftStateOf(await sessionCaller.call(readUnconfirmedDrafts))
			if (unclosed !== undefined) {
				setState(unclosed)
				return
			}
		} catch (error) {
			setState(error instanceof NoSessionError ? SIGN_OUT.IDLE : checkFailureStateOf(error))
			return
		}
		await leave(false)
	}, [leave])

	const startSignOut = useCallback(() => void checkDrafts(), [checkDrafts])
	const { discard, choose, confirm, dismiss: dismissDiscard } = useDraftDiscard(DISCARD_SITUATION.LOGOUT, startSignOut)

	// CAP-015-S09
	useFocusEffect(
		useCallback(() => {
			if (takeResumedSignOut()) {
				startSignOut()
			}
		}, [startSignOut]),
	)

	return {
		state,
		discard,
		isBusy: BUSY_STATES.has(state.kind) || BUSY_DISCARDS.has(discard.kind),
		signOut: startSignOut,
		leave: () => void leave(false),
		leaveWithQueuedClosing: () => void leave(true),
		closeThroughSummary: (draft) => {
			awaitClosingBeforeSignOut(draft.acquisition_id)
			setState(SIGN_OUT.IDLE)
		},
		discardDraft: (draft) => {
			setState(SIGN_OUT.IDLE)
			void choose(draft)
		},
		confirmDiscard: (draft) => void confirm(draft),
		dismissDiscard,
		dismiss: () => setState(SIGN_OUT.IDLE),
	}
}
