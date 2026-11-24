import { describe, expect, it } from "vitest"
import { FULL_LOGIN_REASON, fullLoginRequirement, requiresPinSetup } from "../user-device-credential"

const NOW = new Date("2026-09-30T10:00:00.000Z")
const THIRTY_DAYS = 30 * 24 * 3600
const PIN_KEY = { kty: "OKP", crv: "Ed25519", x: "abc" } as const

function credential(overrides: Partial<Parameters<typeof fullLoginRequirement>[0] & object> = {}) {
	return { pinPublicKey: PIN_KEY, blockedAt: null, lastFullLoginAt: NOW, ...overrides }
}

describe("state of the user–device pair", () => {
	it("CAP-001-S31 requires a full sign-in on a device the user never signed in on", () => {
		expect(fullLoginRequirement(undefined, NOW, THIRTY_DAYS)).toBe(FULL_LOGIN_REASON.NEVER_SIGNED_IN)
		expect(fullLoginRequirement(credential({ lastFullLoginAt: null }), NOW, THIRTY_DAYS)).toBe(
			FULL_LOGIN_REASON.NEVER_SIGNED_IN,
		)
	})

	it("CAP-001-S32 requires it after a block and after the interval", () => {
		expect(fullLoginRequirement(credential({ blockedAt: NOW }), NOW, THIRTY_DAYS)).toBe(FULL_LOGIN_REASON.BLOCKED)
		const old = new Date(NOW.getTime() - THIRTY_DAYS * 1000)
		expect(fullLoginRequirement(credential({ lastFullLoginAt: old }), NOW, THIRTY_DAYS)).toBe(
			FULL_LOGIN_REASON.INTERVAL_EXPIRED,
		)
		expect(fullLoginRequirement(credential(), NOW, THIRTY_DAYS)).toBeUndefined()
	})

	it("CAP-001-S17 wants a new PIN after a block and CAP-001-S18 keeps it after the interval", () => {
		expect(requiresPinSetup(undefined)).toBe(true)
		expect(requiresPinSetup(credential({ pinPublicKey: null }))).toBe(true)
		expect(requiresPinSetup(credential({ blockedAt: NOW }))).toBe(true)
		expect(requiresPinSetup(credential())).toBe(false)
	})
})
