import { ERROR_CODE } from "@ansora/contracts"
import { NoSessionError, type SessionCaller } from "./session-caller"

export interface SessionTerminationApi {
	terminateSession(sessionToken: string): Promise<void>
}

export const SIGN_OUT_OUTCOME = {
	SIGNED_OUT: "signed_out",
	NO_CONNECTION: "no_connection",
	REJECTED: "rejected",
} as const

export type SignOutOutcome =
	| { kind: typeof SIGN_OUT_OUTCOME.SIGNED_OUT }
	| { kind: typeof SIGN_OUT_OUTCOME.NO_CONNECTION }
	| { kind: typeof SIGN_OUT_OUTCOME.REJECTED; code: string }

// CAP-012-R25
const ENDS_ON_DEVICE: readonly string[] = [ERROR_CODE.SIGN_IN_AGAIN, ERROR_CODE.APP_VERSION_UNSUPPORTED]

// CAP-002-S02
export async function signOut(
	caller: SessionCaller,
	api: SessionTerminationApi,
	codeOf: (error: unknown) => string | undefined,
): Promise<SignOutOutcome> {
	try {
		await caller.call((sessionToken) => api.terminateSession(sessionToken))
		return { kind: SIGN_OUT_OUTCOME.SIGNED_OUT }
	} catch (error) {
		if (error instanceof NoSessionError) {
			throw error
		}
		const code = codeOf(error)
		if (code === undefined) {
			return { kind: SIGN_OUT_OUTCOME.NO_CONNECTION }
		}
		if (ENDS_ON_DEVICE.includes(code)) {
			return { kind: SIGN_OUT_OUTCOME.SIGNED_OUT }
		}
		return { kind: SIGN_OUT_OUTCOME.REJECTED, code }
	}
}
