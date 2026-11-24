import { describe, expect, it } from "vitest"
import { hardwareId } from "../../device/public-key"
import { PIN_PROOF_REJECTION, parsePinProof, parsePinPublicKey, verifyPinProof } from "../pin-proof"
import { compactJws, deviceKey, ecPinKey, edPinKey, type TestPinKey } from "./test-keys"

const NOW = new Date("2026-09-30T10:00:00.000Z")
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000)
const PERSONAL_NUMBER = "000101"
const DEVICE = deviceKey()

function proofOf(pin: TestPinKey, overrides: Record<string, unknown> = {}): string {
	return compactJws(pin.privateKey, pin.algorithm, {
		challenge_id: "0b6f1b1a-2c7e-4d3a-9f1e-0a1b2c3d4e5f",
		value: "nonce",
		personal_number: PERSONAL_NUMBER,
		jkt: hardwareId(DEVICE.jwk),
		iat: NOW_SECONDS,
		...overrides,
	})
}

const EXPECTATION = { deviceKey: DEVICE.jwk, personalNumber: PERSONAL_NUMBER, now: NOW }

describe("PIN proof", () => {
	it.each([
		["P-256", ecPinKey],
		["Ed25519", edPinKey],
	])("accepts a %s proof of the pair key over the challenge, personal number and device thumbprint", (_name, keyOf) => {
		const pin = keyOf()
		const parsed = parsePinProof(proofOf(pin))
		expect(parsed?.claims.personalNumber).toBe(PERSONAL_NUMBER)
		expect(parsed && verifyPinProof(parsed, pin.jwk, EXPECTATION)).toEqual({ ok: true })
	})

	it("CAP-001-S16 rejects a proof from a seed unlocked by a wrong PIN — a valid-looking signature of another key", () => {
		const wrongPin = ecPinKey()
		const parsed = parsePinProof(proofOf(wrongPin))
		expect(parsed && verifyPinProof(parsed, ecPinKey().jwk, EXPECTATION)).toEqual({
			ok: false,
			reason: PIN_PROOF_REJECTION.SIGNATURE_INVALID,
		})
	})

	it("binds the proof to the device key and to the personal number of the body", () => {
		const pin = ecPinKey()
		const otherDevice = parsePinProof(proofOf(pin, { jkt: hardwareId(deviceKey().jwk) }))
		expect(otherDevice && verifyPinProof(otherDevice, pin.jwk, EXPECTATION)).toEqual({
			ok: false,
			reason: PIN_PROOF_REJECTION.DEVICE_MISMATCH,
		})
		const otherNumber = parsePinProof(proofOf(pin, { personal_number: "000102" }))
		expect(otherNumber && verifyPinProof(otherNumber, pin.jwk, EXPECTATION)).toEqual({
			ok: false,
			reason: PIN_PROOF_REJECTION.PERSONAL_NUMBER_MISMATCH,
		})
	})

	it("rejects a stale proof and refuses a key whose algorithm the proof does not use", () => {
		const pin = ecPinKey()
		const stale = parsePinProof(proofOf(pin, { iat: NOW_SECONDS - 120 }))
		expect(stale && verifyPinProof(stale, pin.jwk, EXPECTATION)).toEqual({
			ok: false,
			reason: PIN_PROOF_REJECTION.STALE,
		})
		const parsed = parsePinProof(proofOf(pin))
		expect(parsed && verifyPinProof(parsed, edPinKey().jwk, EXPECTATION)).toEqual({
			ok: false,
			reason: PIN_PROOF_REJECTION.SIGNATURE_INVALID,
		})
		expect(parsePinProof(compactJws(pin.privateKey, "ES256", { value: "x" }))).toBeUndefined()
	})

	it("reads the pin_proof_setup JWK and refuses a private member", () => {
		const pin = edPinKey()
		expect(parsePinPublicKey(JSON.stringify(pin.jwk))).toEqual(pin.jwk)
		expect(parsePinPublicKey(JSON.stringify({ ...pin.jwk, d: "secret" }))).toBeUndefined()
		expect(parsePinPublicKey(JSON.stringify({ kty: "EC", crv: "P-256", x: "AAAA", y: "BBBB" }))).toBeUndefined()
		expect(parsePinPublicKey("{")).toBeUndefined()
	})
})
