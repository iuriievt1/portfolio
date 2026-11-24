import { createSessionCaller, cryptoAndKeys, SIGN_OUT_OUTCOME, type SignOutOutcome, signOut } from "@ansora/core-mobile"
import { errorCodeOf } from "../../api/api-error"
import { sessionApi } from "../../api/session"
import { forgetThumbnails } from "../../utils/thumbnail-cache"
import { forgetCaptureSessions } from "../capture/capture-session"
import { forgetTorch } from "../capture/torch"
import { forgetRequestKeys } from "../capture/update-request-keys"
import { forgetMatchingPatients } from "../identification/matching-patients"
import { forgetEarlierPhotos } from "../location/earlier-photos"
import { forgetOpenedPatient } from "../patient/opened-patient"
import { forgetOpenedVisit } from "../visit/opened-visit"
import { forgetRecordMove } from "../visit/record-move"
import {
	closeSession,
	currentSession,
	forgetSession,
	lockSession,
	renewSession,
	SESSION_CLOSURE,
	type SessionClosure,
} from "./session-store"
import { forgetSignOutResume } from "./sign-out-resume"

export const sessionCaller = createSessionCaller(
	sessionApi,
	{
		current: currentSession,
		renewed: renewSession,
		ended: () => closeSessionOnDevice(SESSION_CLOSURE.ENDED),
	},
	errorCodeOf,
)

// CAP-002-R21
export function lockApp(): void {
	lockSession()
	forgetOpenedWork()
	void forgetViewingKey()
}

export async function signOutOfApp(): Promise<SignOutOutcome> {
	const outcome = await signOut(sessionCaller, sessionApi, errorCodeOf)
	if (outcome.kind === SIGN_OUT_OUTCOME.SIGNED_OUT) {
		await closeSessionOnDevice(SESSION_CLOSURE.SIGNED_OUT)
	}
	return outcome
}

async function closeSessionOnDevice(kind: SessionClosure): Promise<void> {
	const personalNumber = currentSession()?.user.personal_number
	const at = new Date()
	closeSession(kind, at)
	forgetOpenedWork()
	await forgetViewingKey()
	if (personalNumber !== undefined) {
		await markAccountSessionEnd(personalNumber, at)
	}
}

async function markAccountSessionEnd(personalNumber: string, at: Date): Promise<void> {
	try {
		const keys = cryptoAndKeys()
		if ((await keys.pinAccount(personalNumber)) !== null) {
			await keys.setCurrentPinAccount(personalNumber, at.toISOString())
		}
	} catch (failure) {
		console.warn("the end of the session could not be stored", failure)
	}
}

// CAP-007-R04
export function forgetSessionOnDevice(): void {
	forgetSession()
	forgetOpenedWork()
}

// CAP-013-R08
function forgetOpenedWork(): void {
	forgetOpenedPatient()
	forgetMatchingPatients()
	forgetOpenedVisit()
	forgetRecordMove()
	forgetCaptureSessions()
	forgetThumbnails()
	forgetEarlierPhotos()
	forgetTorch()
	forgetRequestKeys()
	forgetSignOutResume()
}

async function forgetViewingKey(): Promise<void> {
	try {
		await cryptoAndKeys().closeViewing()
	} catch (failure) {
		console.warn("the viewing key could not be dropped", failure)
	}
}
