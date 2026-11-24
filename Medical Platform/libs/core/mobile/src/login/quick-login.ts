import { ERROR_CODE, type MobileContract } from "@ansora/contracts"
import { NATIVE_ERROR_CODE } from "../native/error-codes"
import type { Session } from "./account-login"

export type Challenge = MobileContract.components["schemas"]["Challenge"]

export interface ChallengeApi {
	issueChallenge(): Promise<Challenge>
}

export interface LoginErrors {
	codeOf(error: unknown): string | undefined
	retryAfterOf(error: unknown): number | undefined
	isNoConnection(error: unknown): boolean
}

export interface ChallengeAttempt {
	prove(challenge: Challenge): Promise<string>
	login(proof: string): Promise<Session>
}

export const QUICK_LOGIN_OUTCOME = {
	SESSION: "session",
	NO_LOCAL_ACCOUNT: "no_local_account",
	NO_CONNECTION: "no_connection",
	PROVIDER_UNAVAILABLE: "provider_unavailable",
	REJECTED: "rejected",
	FAILED: "failed",
} as const

export type QuickLoginOutcome =
	| { kind: typeof QUICK_LOGIN_OUTCOME.SESSION; session: Session }
	| { kind: typeof QUICK_LOGIN_OUTCOME.NO_LOCAL_ACCOUNT }
	| { kind: typeof QUICK_LOGIN_OUTCOME.NO_CONNECTION }
	| { kind: typeof QUICK_LOGIN_OUTCOME.PROVIDER_UNAVAILABLE }
	| { kind: typeof QUICK_LOGIN_OUTCOME.REJECTED; code: string; retryAfterSeconds?: number }
	| { kind: typeof QUICK_LOGIN_OUTCOME.FAILED }

export async function signInWithChallenge(
	api: ChallengeApi,
	errors: LoginErrors,
	attempt: ChallengeAttempt,
): Promise<QuickLoginOutcome> {
	const first = await answerChallenge(api, errors, attempt)
	if (first.kind === QUICK_LOGIN_OUTCOME.REJECTED && first.code === ERROR_CODE.CHALLENGE_INVALID) {
		return await answerChallenge(api, errors, attempt)
	}
	return first
}

async function answerChallenge(
	api: ChallengeApi,
	errors: LoginErrors,
	attempt: ChallengeAttempt,
): Promise<QuickLoginOutcome> {
	let challenge: Challenge
	try {
		challenge = await api.issueChallenge()
	} catch (error) {
		return failure(errors, error)
	}
	let proof: string
	try {
		proof = await attempt.prove(challenge)
	} catch (error) {
		if (errors.codeOf(error) === NATIVE_ERROR_CODE.PIN_ACCOUNT_MISSING) {
			return { kind: QUICK_LOGIN_OUTCOME.NO_LOCAL_ACCOUNT }
		}
		return failure(errors, error)
	}
	try {
		return { kind: QUICK_LOGIN_OUTCOME.SESSION, session: await attempt.login(proof) }
	} catch (error) {
		return failure(errors, error)
	}
}

// CAP-001-R20, CAP-002-R17
function failure(errors: LoginErrors, error: unknown): QuickLoginOutcome {
	if (errors.isNoConnection(error)) {
		return { kind: QUICK_LOGIN_OUTCOME.NO_CONNECTION }
	}
	const code = errors.codeOf(error)
	if (code === undefined) {
		return { kind: QUICK_LOGIN_OUTCOME.FAILED }
	}
	if (code === ERROR_CODE.PROVIDER_UNAVAILABLE) {
		return { kind: QUICK_LOGIN_OUTCOME.PROVIDER_UNAVAILABLE }
	}
	const retryAfterSeconds = errors.retryAfterOf(error)
	return retryAfterSeconds === undefined
		? { kind: QUICK_LOGIN_OUTCOME.REJECTED, code }
		: { kind: QUICK_LOGIN_OUTCOME.REJECTED, code, retryAfterSeconds }
}
