import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { CodedError, codeOf, isNoConnection } from "../../__tests__/coded-error"
import { epochSeconds, JWS_ALGORITHM, SIGNED_BODY_JWS_TYPE } from "../../device/device-proof"
import type { Session } from "../account-login"
import { type CardLoginPorts, cardIdentifierOf, signInWithCard } from "../card-login"
import { carrierBody } from "../carrier-body"
import { QUICK_LOGIN_OUTCOME } from "../quick-login"

const IDENTIFIER = "04A1B2C3D4E5F6"
const NOW = new Date("2026-10-01T10:00:00.000Z")
const SESSION = { session_id: "s", session_outcome: "resumed" } as unknown as Session

interface Signed {
	header: unknown
	payload: unknown
}

function fakes(login?: () => Promise<Session>) {
	const signed: Signed[] = []
	const bodies: string[] = []
	let challenges = 0
	const ports: CardLoginPorts = {
		api: {
			async issueChallenge() {
				challenges += 1
				return { challenge_id: `c${challenges}`, value: "v", expires_at: "2026-10-01T10:02:00.000Z" }
			},
			async loginWithCard(body) {
				bodies.push(body)
				return login ? await login() : SESSION
			},
		},
		signer: {
			async signJws(header, payload) {
				signed.push({ header: JSON.parse(header), payload: JSON.parse(payload) })
				return `jws-${signed.length}`
			},
		},
		codeOf,
		retryAfterOf: () => undefined,
		isNoConnection,
	}
	return { ports, signed, bodies }
}

describe("cardIdentifierOf", () => {
	it("keeps the UID as upper-case hex without separators", () => {
		expect(cardIdentifierOf("04:a1:b2:c3:d4:e5:f6")).toBe(IDENTIFIER)
		expect(cardIdentifierOf("04a1b2c3d4e5f6")).toBe(IDENTIFIER)
	})
})

describe("carrierBody", () => {
	it("CAP-001-R21 signs the challenge and the read identifier with the device key", async () => {
		const { ports, signed } = fakes()
		const body = await carrierBody(
			ports.signer,
			{ challenge_id: "c1", value: "v", expires_at: "" },
			IDENTIFIER,
			() => NOW,
		)
		expect(body).toBe("jws-1")
		expect(signed[0]).toEqual({
			header: { alg: JWS_ALGORITHM, typ: SIGNED_BODY_JWS_TYPE },
			payload: { challenge_id: "c1", value: "v", identifier: IDENTIFIER, iat: epochSeconds(NOW) },
		})
	})
})

describe("signInWithCard", () => {
	it("CAP-001-S03 sends one signed body and returns the session the server issues", async () => {
		const { ports, bodies } = fakes()
		expect(await signInWithCard(ports, IDENTIFIER)).toEqual({ kind: QUICK_LOGIN_OUTCOME.SESSION, session: SESSION })
		expect(bodies).toEqual(["jws-1"])
	})

	it("CAP-001-S15 asks for a fresh challenge once when the first one is spent", async () => {
		let calls = 0
		const { ports, bodies } = fakes(async () => {
			calls += 1
			if (calls === 1) {
				throw new CodedError(ERROR_CODE.CHALLENGE_INVALID)
			}
			return SESSION
		})
		expect(await signInWithCard(ports, IDENTIFIER)).toEqual({ kind: QUICK_LOGIN_OUTCOME.SESSION, session: SESSION })
		expect(bodies).toEqual(["jws-1", "jws-2"])
	})

	it("CAP-001-R20 reports an unknown carrier as a rejection without saying why", async () => {
		const { ports } = fakes(async () => {
			throw new CodedError(ERROR_CODE.LOGIN_FAILED)
		})
		expect(await signInWithCard(ports, IDENTIFIER)).toEqual({
			kind: QUICK_LOGIN_OUTCOME.REJECTED,
			code: ERROR_CODE.LOGIN_FAILED,
		})
	})

	it("reports a lost connection", async () => {
		const { ports } = fakes(async () => {
			throw new TypeError("Network request failed")
		})
		expect(await signInWithCard(ports, IDENTIFIER)).toEqual({ kind: QUICK_LOGIN_OUTCOME.NO_CONNECTION })
	})
})
