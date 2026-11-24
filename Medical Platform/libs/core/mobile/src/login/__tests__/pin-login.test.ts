import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { CodedError, codeOf, isNoConnection, retryAfterOf } from "../../__tests__/coded-error"
import type { PinProofChallenge } from "../../native"
import { NATIVE_ERROR_CODE } from "../../native/error-codes"
import type { Session } from "../account-login"
import { type PinLoginPorts, type PinLoginRequest, signInWithPin } from "../pin-login"
import { QUICK_LOGIN_OUTCOME } from "../quick-login"

const PERSONAL_NUMBER = "000101"
const PIN = "204817"

const SESSION = {
	session_id: "s",
	session_outcome: "resumed",
	session_token: "t",
	token_expires_at: "2026-09-30T10:15:00.000Z",
	session_end: "2026-09-30T18:00:00.000Z",
	user: { id: "u", display_name: "Jana Nováková", roles: ["clinician"], personal_number: PERSONAL_NUMBER },
} as unknown as Session

interface Fakes {
	ports: PinLoginPorts
	challenges: number
	logins: PinLoginRequest[]
	proofs: PinProofChallenge[]
}

function fakes(
	options: {
		challenge?: () => Promise<{ challenge_id: string; value: string; expires_at: string }>
		login?: (request: PinLoginRequest) => Promise<Session>
		proof?: () => Promise<string>
	} = {},
): Fakes {
	const fake: Fakes = { challenges: 0, logins: [], proofs: [], ports: undefined as unknown as PinLoginPorts }
	fake.ports = {
		api: {
			async issueChallenge() {
				fake.challenges += 1
				return options.challenge
					? await options.challenge()
					: { challenge_id: `c${fake.challenges}`, value: "v", expires_at: "2026-09-30T10:02:00.000Z" }
			},
			async loginWithPin(request) {
				fake.logins.push(request)
				return options.login ? await options.login(request) : SESSION
			},
		},
		prover: {
			async pinProof(_personalNumber, _pin, challenge) {
				fake.proofs.push(challenge)
				return options.proof ? await options.proof() : `jws-${challenge.challengeId}`
			},
		},
		codeOf,
		retryAfterOf,
		isNoConnection,
	}
	return fake
}

describe("signInWithPin", () => {
	it("CAP-002-S17 signs the challenge with the account key and returns the session the server issues", async () => {
		const fake = fakes()
		const outcome = await signInWithPin(fake.ports, { personalNumber: PERSONAL_NUMBER, pin: PIN })
		expect(outcome).toEqual({ kind: QUICK_LOGIN_OUTCOME.SESSION, session: SESSION })
		expect(fake.proofs[0]?.challengeId).toBe("c1")
		expect(fake.logins).toEqual([{ personal_number: PERSONAL_NUMBER, proof: "jws-c1" }])
	})

	it("CAP-001-S16 hands the server's rejection of a wrong PIN on as a code", async () => {
		const fake = fakes({ login: async () => Promise.reject(new CodedError(ERROR_CODE.LOGIN_FAILED)) })
		const outcome = await signInWithPin(fake.ports, { personalNumber: PERSONAL_NUMBER, pin: PIN })
		expect(outcome).toEqual({ kind: QUICK_LOGIN_OUTCOME.REJECTED, code: ERROR_CODE.LOGIN_FAILED })
	})

	it("CAP-001-R14 passes the delay the server asks for between attempts on", async () => {
		const fake = fakes({ login: async () => Promise.reject(new CodedError(ERROR_CODE.LOGIN_FAILED, 4)) })
		const outcome = await signInWithPin(fake.ports, { personalNumber: PERSONAL_NUMBER, pin: PIN })
		expect(outcome).toEqual({ kind: QUICK_LOGIN_OUTCOME.REJECTED, code: ERROR_CODE.LOGIN_FAILED, retryAfterSeconds: 4 })
	})

	it("CAP-001-S15 asks for a new challenge once when the first one is spent", async () => {
		let rejected = false
		const fake = fakes({
			login: async () => {
				if (rejected) {
					return SESSION
				}
				rejected = true
				return Promise.reject(new CodedError(ERROR_CODE.CHALLENGE_INVALID))
			},
		})
		const outcome = await signInWithPin(fake.ports, { personalNumber: PERSONAL_NUMBER, pin: PIN })
		expect(outcome.kind).toBe(QUICK_LOGIN_OUTCOME.SESSION)
		expect(fake.challenges).toBe(2)
		expect(fake.logins.map((login) => login.proof)).toEqual(["jws-c1", "jws-c2"])
	})

	it("CAP-001-S15 gives up after the second spent challenge", async () => {
		const fake = fakes({ login: async () => Promise.reject(new CodedError(ERROR_CODE.CHALLENGE_INVALID)) })
		const outcome = await signInWithPin(fake.ports, { personalNumber: PERSONAL_NUMBER, pin: PIN })
		expect(outcome).toEqual({ kind: QUICK_LOGIN_OUTCOME.REJECTED, code: ERROR_CODE.CHALLENGE_INVALID })
		expect(fake.challenges).toBe(2)
	})

	it("CAP-001-S07 passes the block after exhausted attempts on", async () => {
		const fake = fakes({ login: async () => Promise.reject(new CodedError(ERROR_CODE.ATTEMPTS_EXHAUSTED)) })
		const outcome = await signInWithPin(fake.ports, { personalNumber: PERSONAL_NUMBER, pin: PIN })
		expect(outcome).toEqual({ kind: QUICK_LOGIN_OUTCOME.REJECTED, code: ERROR_CODE.ATTEMPTS_EXHAUSTED })
	})

	it("reports a device without a PIN account of the number", async () => {
		const fake = fakes({ proof: async () => Promise.reject(new CodedError(NATIVE_ERROR_CODE.PIN_ACCOUNT_MISSING)) })
		const outcome = await signInWithPin(fake.ports, { personalNumber: PERSONAL_NUMBER, pin: PIN })
		expect(outcome).toEqual({ kind: QUICK_LOGIN_OUTCOME.NO_LOCAL_ACCOUNT })
		expect(fake.logins).toEqual([])
	})

	it("CAP-002-S20 reports no connection when the challenge cannot be fetched", async () => {
		const fake = fakes({ challenge: async () => Promise.reject(new TypeError("Network request failed")) })
		const outcome = await signInWithPin(fake.ports, { personalNumber: PERSONAL_NUMBER, pin: PIN })
		expect(outcome).toEqual({ kind: QUICK_LOGIN_OUTCOME.NO_CONNECTION })
	})

	it("CAP-001-R20 reports an answer of the server without a code as a technical failure, not as no connection", async () => {
		const fake = fakes({ login: async () => Promise.reject(new Error("The API returned 502: unknown error")) })
		const outcome = await signInWithPin(fake.ports, { personalNumber: PERSONAL_NUMBER, pin: PIN })
		expect(outcome).toEqual({ kind: QUICK_LOGIN_OUTCOME.FAILED })
	})

	it("CAP-001-R20 reports a failure on the device without a code as a technical failure", async () => {
		const fake = fakes({ proof: async () => Promise.reject(new Error("the key could not sign")) })
		const outcome = await signInWithPin(fake.ports, { personalNumber: PERSONAL_NUMBER, pin: PIN })
		expect(outcome).toEqual({ kind: QUICK_LOGIN_OUTCOME.FAILED })
		expect(fake.logins).toEqual([])
	})

	it("CAP-001-S10 reports the provider as unavailable", async () => {
		const fake = fakes({ login: async () => Promise.reject(new CodedError(ERROR_CODE.PROVIDER_UNAVAILABLE)) })
		const outcome = await signInWithPin(fake.ports, { personalNumber: PERSONAL_NUMBER, pin: PIN })
		expect(outcome).toEqual({ kind: QUICK_LOGIN_OUTCOME.PROVIDER_UNAVAILABLE })
	})
})
