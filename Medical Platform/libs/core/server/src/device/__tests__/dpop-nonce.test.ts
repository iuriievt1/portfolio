import { describe, expect, it } from "vitest"
import { MILLISECONDS_PER_SECOND } from "../../login/secret"
import { DPOP_NONCE_ROTATION_SECONDS, DpopNonceRing, randomDpopNonce } from "../dpop-nonce"

const START = new Date("2026-10-05T09:00:00Z")
const PERIOD_MILLISECONDS = DPOP_NONCE_ROTATION_SECONDS * MILLISECONDS_PER_SECOND

function after(milliseconds: number): Date {
	return new Date(START.getTime() + milliseconds)
}

function sequenceRing(): DpopNonceRing {
	let issued = 0
	return new DpopNonceRing(START, () => {
		issued += 1
		return `nonce-${issued}`
	})
}

describe("DpopNonceRing", () => {
	it("keeps one nonce for the whole period", () => {
		const ring = sequenceRing()

		expect(ring.currentNonce(START)).toBe("nonce-1")
		expect(ring.currentNonce(after(PERIOD_MILLISECONDS - 1))).toBe("nonce-1")
		expect(ring.accepts("nonce-1", after(PERIOD_MILLISECONDS - 1))).toBe(true)
	})

	it("Q-082 refuses a proof without a nonce or with one the server never issued", () => {
		const ring = sequenceRing()

		expect(ring.accepts(undefined, START)).toBe(false)
		expect(ring.accepts("forged", START)).toBe(false)
	})

	it("rotates after a period and still accepts the previous nonce for one more", () => {
		const ring = sequenceRing()

		expect(ring.currentNonce(after(PERIOD_MILLISECONDS))).toBe("nonce-2")
		expect(ring.accepts("nonce-1", after(2 * PERIOD_MILLISECONDS - 1))).toBe(true)
		expect(ring.accepts("nonce-1", after(2 * PERIOD_MILLISECONDS))).toBe(false)
		expect(ring.accepts("nonce-2", after(2 * PERIOD_MILLISECONDS))).toBe(true)
	})

	it("Q-082 refuses a stale nonce after the server was quiet for two periods", () => {
		const ring = sequenceRing()

		expect(ring.accepts("nonce-1", after(2 * PERIOD_MILLISECONDS))).toBe(false)
		expect(ring.currentNonce(after(2 * PERIOD_MILLISECONDS))).toBe("nonce-2")
	})

	it("issues unguessable nonces of 128 bits", () => {
		const nonce = randomDpopNonce()

		expect(Buffer.from(nonce, "base64url")).toHaveLength(16)
		expect(randomDpopNonce()).not.toBe(nonce)
	})
})
