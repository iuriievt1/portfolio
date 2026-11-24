import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { CodedError, codeOf, isNoConnection } from "../../__tests__/coded-error"
import type { Session } from "../account-login"
import { type BarcodeLoginPorts, signInWithBarcode } from "../barcode-login"
import { QUICK_LOGIN_OUTCOME } from "../quick-login"

const CONTENT = "JNOVAKOVA"
const SESSION = { session_id: "s", session_outcome: "resumed" } as unknown as Session

function fakes(login?: () => Promise<Session>) {
	const identifiers: unknown[] = []
	const bodies: string[] = []
	const ports: BarcodeLoginPorts = {
		api: {
			issueChallenge: async () => ({ challenge_id: "c", value: "v", expires_at: "2026-10-26T10:02:00.000Z" }),
			async loginWithBarcode(body) {
				bodies.push(body)
				return login ? await login() : SESSION
			},
		},
		signer: {
			async signJws(_header, payload) {
				identifiers.push(JSON.parse(payload).identifier)
				return `jws-${identifiers.length}`
			},
		},
		codeOf,
		retryAfterOf: () => undefined,
		isNoConnection,
	}
	return { ports, identifiers, bodies }
}

describe("signInWithBarcode", () => {
	it("signs the whole read content of the card barcode and returns the session the server issues", async () => {
		const { ports, identifiers, bodies } = fakes()
		expect(await signInWithBarcode(ports, CONTENT)).toEqual({ kind: QUICK_LOGIN_OUTCOME.SESSION, session: SESSION })
		expect(identifiers).toEqual([CONTENT])
		expect(bodies).toEqual(["jws-1"])
	})

	it("CAP-001-R20 reports a barcode of nobody as a rejection without saying why", async () => {
		const { ports } = fakes(async () => {
			throw new CodedError(ERROR_CODE.LOGIN_FAILED)
		})
		expect(await signInWithBarcode(ports, CONTENT)).toEqual({
			kind: QUICK_LOGIN_OUTCOME.REJECTED,
			code: ERROR_CODE.LOGIN_FAILED,
		})
	})
})
