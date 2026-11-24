import { describe, expect, it } from "vitest"
import { SIGNED_BODY_REJECTION, verifySignedBody } from "../signed-body"
import { compactJws, deviceKey } from "./test-keys"

const NOW = new Date("2026-09-30T10:00:00.000Z")
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000)
const CLAIMS = {
	challenge_id: "0b6f1b1a-2c7e-4d3a-9f1e-0a1b2c3d4e5f",
	value: "nonce",
	identifier: "04A1B2C3",
	iat: NOW_SECONDS,
}

describe("signed body of the card and QR code login", () => {
	it("CAP-001-R21 accepts a body signed by the device key and reads the challenge and identifier", () => {
		const key = deviceKey()
		const verdict = verifySignedBody(compactJws(key.privateKey, "ES256", CLAIMS), key.jwk, NOW)
		expect(verdict).toEqual({
			ok: true,
			claims: {
				challengeId: CLAIMS.challenge_id,
				value: "nonce",
				identifier: "04A1B2C3",
				bindingCode: undefined,
				issuedAt: NOW_SECONDS,
			},
		})
	})

	it("CAP-005-R17 carries the binding code when the body founds a card binding", () => {
		const key = deviceKey()
		const verdict = verifySignedBody(
			compactJws(key.privateKey, "ES256", { ...CLAIMS, binding_code: "ABCD2345EFGH" }),
			key.jwk,
			NOW,
		)
		expect(verdict.ok && verdict.claims.bindingCode).toBe("ABCD2345EFGH")
	})

	it("rejects a body signed by another key before reading the identifier", () => {
		const verdict = verifySignedBody(compactJws(deviceKey().privateKey, "ES256", CLAIMS), deviceKey().jwk, NOW)
		expect(verdict).toEqual({ ok: false, reason: SIGNED_BODY_REJECTION.SIGNATURE_INVALID })
	})

	it("rejects a stale body and a malformed one", () => {
		const key = deviceKey()
		const stale = compactJws(key.privateKey, "ES256", { ...CLAIMS, iat: NOW_SECONDS - 61 })
		expect(verifySignedBody(stale, key.jwk, NOW)).toEqual({ ok: false, reason: SIGNED_BODY_REJECTION.STALE })
		const withoutIdentifier = compactJws(key.privateKey, "ES256", { ...CLAIMS, identifier: "" })
		expect(verifySignedBody(withoutIdentifier, key.jwk, NOW)).toEqual({
			ok: false,
			reason: SIGNED_BODY_REJECTION.MALFORMED,
		})
		expect(verifySignedBody("not.a.jws", key.jwk, NOW)).toEqual({ ok: false, reason: SIGNED_BODY_REJECTION.MALFORMED })
	})
})
