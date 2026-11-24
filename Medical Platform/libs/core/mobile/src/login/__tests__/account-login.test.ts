import { ERROR_CODE, LOGIN_RETURN_URL } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import {
	ACCOUNT_LOGIN_OUTCOME,
	type AccountLoginPorts,
	LOGIN_WINDOW_RESULT,
	type LoginWindowResult,
	type OidcCallbackRequest,
	type Session,
	signInWithAccount,
} from "../account-login"

const DISCOVERY_URL = "https://idp.example/application/o/vulna/.well-known/openid-configuration"
const ISSUER = "https://idp.example/application/o/vulna/"
const AUTHORIZATION_ENDPOINT = "https://idp.example/application/o/authorize/"
const STATE = "state-1"

class ProblemError extends Error {
	constructor(readonly code: string) {
		super(code)
	}
}

const SESSION = {
	session_id: "s",
	session_outcome: "created",
	session_token: "t",
	token_expires_at: "2026-09-30T10:15:00.000Z",
	session_end: "2026-09-30T18:00:00.000Z",
	user: { id: "u", display_name: "Jana Nováková", roles: ["clinician"], personal_number: "000101" },
} as unknown as Session

interface Fakes {
	ports: AccountLoginPorts
	completions: OidcCallbackRequest[]
	opened: string[]
}

function fakes(
	options: {
		window?: LoginWindowResult
		discovery?: unknown
		complete?: (request: OidcCallbackRequest) => Promise<Session>
		start?: () => Promise<{ authorization_url: string; issuer: string; state: string }>
	} = {},
): Fakes {
	const completions: OidcCallbackRequest[] = []
	const opened: string[] = []
	const ports: AccountLoginPorts = {
		api: {
			startOidcLogin:
				options.start ??
				(async () => ({ authorization_url: `${AUTHORIZATION_ENDPOINT}?state=${STATE}`, issuer: ISSUER, state: STATE })),
			completeOidcLogin: async (request) => {
				completions.push(request)
				return await (options.complete ?? (async () => SESSION))(request)
			},
		},
		window: {
			open: async (url) => {
				opened.push(url)
				return (
					options.window ?? {
						type: LOGIN_WINDOW_RESULT.RETURNED,
						url: `${LOGIN_RETURN_URL}?state=${STATE}&completion_code=code-1`,
					}
				)
			},
		},
		discovery: {
			read: async () => {
				if (options.discovery instanceof Error) {
					throw options.discovery
				}
				return options.discovery ?? { issuer: ISSUER, authorization_endpoint: AUTHORIZATION_ENDPOINT }
			},
		},
		discoveryUrl: DISCOVERY_URL,
		returnUrl: LOGIN_RETURN_URL,
		problemCodeOf: (error) => (error instanceof ProblemError ? error.code : undefined),
	}
	return { ports, completions, opened }
}

describe("full sign-in with the account", () => {
	it("CAP-001-S01 starts, checks discovery, opens the window and completes with the state and code it got back", async () => {
		const { ports, completions, opened } = fakes()
		const outcome = await signInWithAccount(ports, { reason: "first_login" })
		expect(outcome).toEqual({ kind: ACCOUNT_LOGIN_OUTCOME.SESSION, session: SESSION })
		expect(opened).toEqual([`${AUTHORIZATION_ENDPOINT}?state=${STATE}`])
		expect(completions).toEqual([{ state: STATE, completion_code: "code-1" }])
	})

	it("CAP-001-S36 does not open the window when the address disagrees with discovery", async () => {
		const { ports, opened } = fakes({
			discovery: { issuer: ISSUER, authorization_endpoint: "https://evil.example/authorize" },
		})
		const outcome = await signInWithAccount(ports, { reason: "first_login" })
		expect(outcome.kind).toBe(ACCOUNT_LOGIN_OUTCOME.AUTHORIZATION_MISMATCH)
		expect(opened).toEqual([])
	})

	it("CAP-001-S10 reports the provider unavailable when discovery cannot be read", async () => {
		const { ports, opened } = fakes({ discovery: new Error("fetch failed") })
		expect(await signInWithAccount(ports, { reason: "first_login" })).toEqual({
			kind: ACCOUNT_LOGIN_OUTCOME.PROVIDER_UNAVAILABLE,
		})
		expect(opened).toEqual([])
	})

	it("CAP-001-S17 asks for a PIN when the server requires its setup and completes the same flow with it", async () => {
		const { ports, completions } = fakes({
			complete: async (request) => {
				if (request.pin_proof_setup === undefined) {
					throw new ProblemError(ERROR_CODE.PIN_SETUP_REQUIRED)
				}
				return SESSION
			},
		})
		const outcome = await signInWithAccount(ports, { reason: "first_login" })
		expect(outcome.kind).toBe(ACCOUNT_LOGIN_OUTCOME.PIN_SETUP_REQUIRED)
		if (outcome.kind !== ACCOUNT_LOGIN_OUTCOME.PIN_SETUP_REQUIRED) {
			return
		}
		expect(await outcome.complete('{"kty":"OKP"}')).toEqual({ kind: ACCOUNT_LOGIN_OUTCOME.SESSION, session: SESSION })
		expect(completions).toEqual([
			{ state: STATE, completion_code: "code-1" },
			{ state: STATE, completion_code: "code-1", pin_proof_setup: '{"kty":"OKP"}' },
		])
	})

	it("CAP-001-S13 refuses a return that belongs to another flow", async () => {
		const { ports, completions } = fakes({
			window: { type: LOGIN_WINDOW_RESULT.RETURNED, url: `${LOGIN_RETURN_URL}?state=other&completion_code=code-1` },
		})
		expect(await signInWithAccount(ports, { reason: "first_login" })).toEqual({
			kind: ACCOUNT_LOGIN_OUTCOME.REJECTED,
			code: ERROR_CODE.COMPLETION_CODE_INVALID,
		})
		expect(completions).toEqual([])
	})

	it("passes the server's stable codes and the loss of connection on to the screen", async () => {
		const stale = fakes({
			complete: async () => {
				throw new ProblemError(ERROR_CODE.LOGIN_AUTHENTICATION_STALE)
			},
		})
		expect(await signInWithAccount(stale.ports, { reason: "first_login" })).toEqual({
			kind: ACCOUNT_LOGIN_OUTCOME.REJECTED,
			code: ERROR_CODE.LOGIN_AUTHENTICATION_STALE,
		})
		const offline = fakes({
			start: async () => {
				throw new TypeError("Network request failed")
			},
		})
		expect(await signInWithAccount(offline.ports, { reason: "first_login" })).toEqual({
			kind: ACCOUNT_LOGIN_OUTCOME.NO_CONNECTION,
		})
		const cancelled = fakes({ window: { type: LOGIN_WINDOW_RESULT.CANCELLED } })
		expect(await signInWithAccount(cancelled.ports, { reason: "first_login" })).toEqual({
			kind: ACCOUNT_LOGIN_OUTCOME.CANCELLED,
		})
	})

	it("CAP-001-S20 sends the expected personal number of a known account and nothing for an unknown one", async () => {
		const requests: unknown[] = []
		const { ports } = fakes({
			start: async () => ({ authorization_url: `${AUTHORIZATION_ENDPOINT}?s`, issuer: ISSUER, state: STATE }),
		})
		ports.api.startOidcLogin = async (request) => {
			requests.push(request)
			return { authorization_url: `${AUTHORIZATION_ENDPOINT}?s`, issuer: ISSUER, state: STATE }
		}
		await signInWithAccount(ports, { reason: "interval_expired", expectedPersonalNumber: "000101" })
		await signInWithAccount(ports, { reason: "first_login" })
		expect(requests).toEqual([
			{ reason: "interval_expired", expected_personal_number: "000101" },
			{ reason: "first_login" },
		])
	})
})
