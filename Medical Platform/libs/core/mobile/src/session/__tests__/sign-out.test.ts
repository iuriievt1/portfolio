import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { CodedError, codeOf } from "../../__tests__/coded-error"
import { NoSessionError, type SessionCaller } from "../session-caller"
import { SIGN_OUT_OUTCOME, signOut } from "../sign-out"

const SESSION_TOKEN = "session-token"

const caller: SessionCaller = {
	call: (work) => work(SESSION_TOKEN),
}

function terminationFailingWith(error: Error) {
	return {
		terminateSession: async () => {
			throw error
		},
	}
}

describe("signOut", () => {
	it("CAP-002-S02 asks the server to end the session with its token", async () => {
		const tokens: string[] = []
		const api = {
			terminateSession: async (sessionToken: string) => {
				tokens.push(sessionToken)
			},
		}

		expect(await signOut(caller, api, codeOf)).toEqual({ kind: SIGN_OUT_OUTCOME.SIGNED_OUT })
		expect(tokens).toEqual([SESSION_TOKEN])
	})

	it("does not sign out without a connection to the server", async () => {
		const outcome = await signOut(caller, terminationFailingWith(new TypeError("Network request failed")), codeOf)
		expect(outcome).toEqual({ kind: SIGN_OUT_OUTCOME.NO_CONNECTION })
	})

	it("signs out on the device when the server already ended the session", async () => {
		const outcome = await signOut(caller, terminationFailingWith(new CodedError(ERROR_CODE.SIGN_IN_AGAIN)), codeOf)
		expect(outcome).toEqual({ kind: SIGN_OUT_OUTCOME.SIGNED_OUT })
	})

	it("CAP-012-R25 signs out on the device when the server refuses the app version", async () => {
		const failure = new CodedError(ERROR_CODE.APP_VERSION_UNSUPPORTED)
		expect(await signOut(caller, terminationFailingWith(failure), codeOf)).toEqual({
			kind: SIGN_OUT_OUTCOME.SIGNED_OUT,
		})
	})

	it("reports any other refusal with its code", async () => {
		const outcome = await signOut(caller, terminationFailingWith(new CodedError(ERROR_CODE.DEVICE_REVOKED)), codeOf)
		expect(outcome).toEqual({ kind: SIGN_OUT_OUTCOME.REJECTED, code: ERROR_CODE.DEVICE_REVOKED })
	})

	it("leaves a locked app to the lock screen", async () => {
		const locked: SessionCaller = {
			call: async () => {
				throw new NoSessionError()
			},
		}
		await expect(signOut(locked, terminationFailingWith(new Error("unused")), codeOf)).rejects.toBeInstanceOf(
			NoSessionError,
		)
	})
})
