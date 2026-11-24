import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { CodedError, codeOf, isNoConnection } from "../../__tests__/coded-error"
import type { Session } from "../account-login"
import { type QrCodeLoginPorts, signInWithQrCode } from "../qr-code-login"
import { QUICK_LOGIN_OUTCOME } from "../quick-login"

const CONTENT = "VULNA1.1.ABCDEFGHIJKLMNOPQRSTUVWXYZ.SIGNATURE"
const SESSION = { session_id: "s", session_outcome: "resumed" } as unknown as Session

function fakes(login?: () => Promise<Session>) {
	const identifiers: unknown[] = []
	const bodies: string[] = []
	const ports: QrCodeLoginPorts = {
		api: {
			issueChallenge: async () => ({ challenge_id: "c", value: "v", expires_at: "2026-10-01T10:02:00.000Z" }),
			async loginWithQrCode(body) {
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

describe("signInWithQrCode", () => {
	it("CAP-001-S28 signs the whole read content and returns the session the server issues", async () => {
		const { ports, identifiers, bodies } = fakes()
		expect(await signInWithQrCode(ports, CONTENT)).toEqual({ kind: QUICK_LOGIN_OUTCOME.SESSION, session: SESSION })
		expect(identifiers).toEqual([CONTENT])
		expect(bodies).toEqual(["jws-1"])
	})

	it("CAP-001-R20 reports an unknown code as a rejection without saying why", async () => {
		const { ports } = fakes(async () => {
			throw new CodedError(ERROR_CODE.LOGIN_FAILED)
		})
		expect(await signInWithQrCode(ports, CONTENT)).toEqual({
			kind: QUICK_LOGIN_OUTCOME.REJECTED,
			code: ERROR_CODE.LOGIN_FAILED,
		})
	})
})
