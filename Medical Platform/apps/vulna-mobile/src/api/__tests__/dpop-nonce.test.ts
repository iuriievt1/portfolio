import { DPOP_NONCE_HEADER, USE_DPOP_NONCE_ERROR, WWW_AUTHENTICATE_HEADER } from "@ansora/contracts"
import { describe, expect, it, vi } from "vitest"

const NONCE_CHALLENGE = `DPoP error="${USE_DPOP_NONCE_ERROR}"`

function answer(status: number, headers: Record<string, string>) {
	return { status, headers: new Headers(headers) }
}

async function freshModule() {
	vi.resetModules()
	return await import("../dpop-nonce")
}

describe("DPoP nonce", () => {
	it("Q-082 has no nonce until the server sends one", async () => {
		const { latestNonce } = await freshModule()
		expect(latestNonce()).toBeUndefined()
	})

	it("Q-082 keeps the newest nonce from any answer", async () => {
		const { latestNonce, rememberNonce } = await freshModule()

		rememberNonce(answer(200, { [DPOP_NONCE_HEADER]: "first" }))
		rememberNonce(answer(403, { [DPOP_NONCE_HEADER]: "second" }))
		rememberNonce(answer(200, {}))

		expect(latestNonce()).toBe("second")
	})

	it("Q-082 retries only when the server asks for a nonce, not on another 401", async () => {
		const { isNonceRequired } = await freshModule()

		expect(isNonceRequired(answer(401, { [WWW_AUTHENTICATE_HEADER]: NONCE_CHALLENGE, [DPOP_NONCE_HEADER]: "n" }))).toBe(
			true,
		)
		expect(isNonceRequired(answer(401, { [DPOP_NONCE_HEADER]: "n" }))).toBe(false)
		expect(isNonceRequired(answer(403, { [WWW_AUTHENTICATE_HEADER]: NONCE_CHALLENGE }))).toBe(false)
	})
})
