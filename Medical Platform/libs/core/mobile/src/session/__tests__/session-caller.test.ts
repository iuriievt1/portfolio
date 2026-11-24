import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { CodedError, codeOf } from "../../__tests__/coded-error"
import type { Session } from "../../login/account-login"
import {
	createSessionCaller,
	NoSessionError,
	type SessionHolder,
	type SessionRefreshApi,
	type SessionRefreshRequest,
} from "../session-caller"

const SESSION_ID = "11111111-1111-4111-8111-111111111111"
const EXPIRED_TOKEN = "expired-token"
const RENEWED_TOKEN = "renewed-token"

function sessionWith(token: string): Session {
	return { session_id: SESSION_ID, session_token: token } as Session
}

interface Fakes {
	holder: SessionHolder & { session: Session | undefined; ends: number }
	api: SessionRefreshApi & { requests: { sessionToken: string; request: SessionRefreshRequest }[] }
}

function fakes(refresh: () => Promise<Session> = async () => sessionWith(RENEWED_TOKEN)): Fakes {
	const holder = {
		session: sessionWith(EXPIRED_TOKEN) as Session | undefined,
		ends: 0,
		current: () => holder.session,
		renewed: (session: Session) => {
			if (holder.session?.session_id === session.session_id) {
				holder.session = session
			}
		},
		ended: async () => {
			holder.ends += 1
			holder.session = undefined
		},
	}
	const api = {
		requests: [] as { sessionToken: string; request: SessionRefreshRequest }[],
		refreshSession: async (sessionToken: string, request: SessionRefreshRequest) => {
			api.requests.push({ sessionToken, request })
			return await refresh()
		},
	}
	return { holder, api }
}

function workAcceptingOnly(token: string, tokens: string[]): (sessionToken: string) => Promise<string> {
	return async (sessionToken) => {
		tokens.push(sessionToken)
		if (sessionToken !== token) {
			throw new CodedError(ERROR_CODE.SIGN_IN_AGAIN)
		}
		return "done"
	}
}

describe("createSessionCaller", () => {
	it("CAP-002-S04 refreshes the expired token of the session and repeats the call", async () => {
		const { holder, api } = fakes()
		const tokens: string[] = []

		const result = await createSessionCaller(api, holder, codeOf).call(workAcceptingOnly(RENEWED_TOKEN, tokens))

		expect(result).toBe("done")
		expect(tokens).toEqual([EXPIRED_TOKEN, RENEWED_TOKEN])
		expect(api.requests).toEqual([{ sessionToken: EXPIRED_TOKEN, request: { scope: "user", session_id: SESSION_ID } }])
		expect(holder.session?.session_token).toBe(RENEWED_TOKEN)
	})

	it("CAP-002-S08 ends the session when the server refuses the refresh", async () => {
		const { holder, api } = fakes(async () => {
			throw new CodedError(ERROR_CODE.SIGN_IN_AGAIN)
		})
		const tokens: string[] = []

		const call = createSessionCaller(api, holder, codeOf).call(workAcceptingOnly(RENEWED_TOKEN, tokens))

		await expect(call).rejects.toMatchObject({ code: ERROR_CODE.SIGN_IN_AGAIN })
		expect(holder.ends).toBe(1)
		expect(tokens).toEqual([EXPIRED_TOKEN])
	})

	it("keeps the session when the identity provider is unavailable", async () => {
		const { holder, api } = fakes(async () => {
			throw new CodedError(ERROR_CODE.PROVIDER_UNAVAILABLE)
		})

		const call = createSessionCaller(api, holder, codeOf).call(workAcceptingOnly(RENEWED_TOKEN, []))

		await expect(call).rejects.toMatchObject({ code: ERROR_CODE.PROVIDER_UNAVAILABLE })
		expect(holder.ends).toBe(0)
		expect(holder.session?.session_token).toBe(EXPIRED_TOKEN)
	})

	it("passes other refusals through without a refresh", async () => {
		const { holder, api } = fakes()

		const call = createSessionCaller(api, holder, codeOf).call(async () => {
			throw new CodedError(ERROR_CODE.DEVICE_REVOKED)
		})

		await expect(call).rejects.toMatchObject({ code: ERROR_CODE.DEVICE_REVOKED })
		expect(api.requests).toEqual([])
	})

	it("CAP-002-S34 sends nothing and refreshes nothing while the app is locked", async () => {
		const { holder, api } = fakes()
		holder.session = undefined
		const tokens: string[] = []

		const call = createSessionCaller(api, holder, codeOf).call(workAcceptingOnly(RENEWED_TOKEN, tokens))

		await expect(call).rejects.toBeInstanceOf(NoSessionError)
		expect(tokens).toEqual([])
		expect(api.requests).toEqual([])
	})

	it("CAP-002-S34 does not use a token renewed after the app locked", async () => {
		const { holder, api } = fakes(async () => {
			holder.session = undefined
			return sessionWith(RENEWED_TOKEN)
		})
		const tokens: string[] = []

		const call = createSessionCaller(api, holder, codeOf).call(workAcceptingOnly(RENEWED_TOKEN, tokens))

		await expect(call).rejects.toBeInstanceOf(NoSessionError)
		expect(tokens).toEqual([EXPIRED_TOKEN])
		expect(holder.session).toBeUndefined()
	})

	it("refreshes once for calls that fail together", async () => {
		const { holder, api } = fakes()
		const caller = createSessionCaller(api, holder, codeOf)
		const tokens: string[] = []

		const results = await Promise.all([
			caller.call(workAcceptingOnly(RENEWED_TOKEN, tokens)),
			caller.call(workAcceptingOnly(RENEWED_TOKEN, tokens)),
		])

		expect(results).toEqual(["done", "done"])
		expect(api.requests).toHaveLength(1)
	})
})
