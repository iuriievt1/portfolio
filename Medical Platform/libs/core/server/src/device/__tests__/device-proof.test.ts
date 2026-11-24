import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
	CLOCK_SKEW_TOLERANCE_SECONDS,
	DEVICE_PROOF_REJECTION,
	DEVICE_PROOF_TYPE,
	proofUri,
	verifyDeviceProof,
} from "../device-proof"
import { JWS_ALGORITHM } from "../jws"
import { approvalFingerprint, hardwareId, isPublicKeyJwk, type PublicKeyJwk } from "../public-key"

const NOW = new Date("2026-09-22T10:00:00.000Z")
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000)
const URL_UNDER_TEST = "https://vulna.example/api/v1/device/registration"
const FINGERPRINT = /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/

interface TestKey {
	privateKey: KeyObject
	jwk: PublicKeyJwk
}

function deviceKey(): TestKey {
	const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
	const exported = publicKey.export({ format: "jwk" })
	return { privateKey, jwk: { kty: "EC", crv: "P-256", x: exported.x as string, y: exported.y as string } }
}

function sign(key: KeyObject, header: object, payload: object): string {
	const signingInput = `${base64Url(header)}.${base64Url(payload)}`
	const signer = createSign("sha256").update(signingInput)
	const signature = signer.sign({ key, dsaEncoding: "ieee-p1363" })
	return `${signingInput}.${signature.toString("base64url")}`
}

function base64Url(value: object): string {
	return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function proofOf(key: TestKey, claims: Record<string, unknown> = {}): string {
	return sign(
		key.privateKey,
		{ typ: DEVICE_PROOF_TYPE, alg: JWS_ALGORITHM, jwk: key.jwk },
		{ jti: "jti-1", htm: "POST", htu: URL_UNDER_TEST, iat: NOW_SECONDS, ...claims },
	)
}

describe("verifyDeviceProof", () => {
	it("accepts a proof signed by the key in its own header", () => {
		const key = deviceKey()

		const verdict = verifyDeviceProof(proofOf(key), { method: "post", url: `${URL_UNDER_TEST}?x=1`, now: NOW })

		expect(verdict).toEqual({ ok: true, jwk: key.jwk, jti: "jti-1", issuedAt: NOW_SECONDS, nonce: undefined })
	})

	it("CAP-006-S04 turns down a copy of the app that carries a key it cannot use", () => {
		const original = deviceKey()
		const copy = deviceKey()
		const forged = sign(
			copy.privateKey,
			{ typ: DEVICE_PROOF_TYPE, alg: JWS_ALGORITHM, jwk: original.jwk },
			{ jti: "jti-1", htm: "POST", htu: URL_UNDER_TEST, iat: NOW_SECONDS },
		)

		expect(verifyDeviceProof(forged, { method: "POST", url: URL_UNDER_TEST, now: NOW })).toEqual({
			ok: false,
			reason: DEVICE_PROOF_REJECTION.SIGNATURE_INVALID,
		})
		expect(
			verifyDeviceProof(proofOf(copy), {
				method: "POST",
				url: URL_UNDER_TEST,
				now: NOW,
				knownKey: original.jwk,
			}),
		).toEqual({ ok: false, reason: DEVICE_PROOF_REJECTION.KEY_MISMATCH })
		expect(hardwareId(copy.jwk)).not.toBe(hardwareId(original.jwk))
	})

	it("rejects a proof whose signature was made by another key", () => {
		const key = deviceKey()
		const intruder = deviceKey()
		const forged = sign(
			intruder.privateKey,
			{ typ: DEVICE_PROOF_TYPE, alg: JWS_ALGORITHM, jwk: key.jwk },
			{ jti: "jti-1", htm: "POST", htu: URL_UNDER_TEST, iat: NOW_SECONDS },
		)

		expect(verifyDeviceProof(forged, { method: "POST", url: URL_UNDER_TEST, now: NOW })).toEqual({
			ok: false,
			reason: DEVICE_PROOF_REJECTION.SIGNATURE_INVALID,
		})
	})

	it("rejects a proof whose key is not the one remembered at registration", () => {
		const other = deviceKey()

		const verdict = verifyDeviceProof(proofOf(deviceKey()), {
			method: "POST",
			url: URL_UNDER_TEST,
			now: NOW,
			knownKey: other.jwk,
		})

		expect(verdict).toEqual({ ok: false, reason: DEVICE_PROOF_REJECTION.KEY_MISMATCH })
	})

	it("rejects a proof made for another method or address", () => {
		const key = deviceKey()

		expect(verifyDeviceProof(proofOf(key), { method: "GET", url: URL_UNDER_TEST, now: NOW })).toMatchObject({
			reason: DEVICE_PROOF_REJECTION.REQUEST_MISMATCH,
		})
		expect(
			verifyDeviceProof(proofOf(key), { method: "POST", url: "https://vulna.example/api/v1/queue", now: NOW }),
		).toMatchObject({ reason: DEVICE_PROOF_REJECTION.REQUEST_MISMATCH })
	})

	it("accepts a proof inside the clock skew tolerance and rejects it outside", () => {
		const key = deviceKey()
		const inside = proofOf(key, { iat: NOW_SECONDS - CLOCK_SKEW_TOLERANCE_SECONDS })
		const outside = proofOf(key, { iat: NOW_SECONDS - CLOCK_SKEW_TOLERANCE_SECONDS - 1 })

		expect(verifyDeviceProof(inside, { method: "POST", url: URL_UNDER_TEST, now: NOW }).ok).toBe(true)
		expect(verifyDeviceProof(outside, { method: "POST", url: URL_UNDER_TEST, now: NOW })).toEqual({
			ok: false,
			reason: DEVICE_PROOF_REJECTION.STALE,
		})
	})

	it("rejects a proof whose identifier the server has already consumed", () => {
		const key = deviceKey()

		const verdict = verifyDeviceProof(proofOf(key), {
			method: "POST",
			url: URL_UNDER_TEST,
			now: NOW,
			isReplayed: (jti) => jti === "jti-1",
		})

		expect(verdict).toEqual({ ok: false, reason: DEVICE_PROOF_REJECTION.REPLAYED })
	})

	it("rejects a proof that is not a compact token with a device key in its header", () => {
		const key = deviceKey()
		const wrongType = sign(
			key.privateKey,
			{ typ: "jwt", alg: JWS_ALGORITHM, jwk: key.jwk },
			{ jti: "jti-1", htm: "POST", htu: URL_UNDER_TEST, iat: NOW_SECONDS },
		)

		expect(verifyDeviceProof("not-a-token", { method: "POST", url: URL_UNDER_TEST, now: NOW })).toEqual({
			ok: false,
			reason: DEVICE_PROOF_REJECTION.MALFORMED,
		})
		expect(verifyDeviceProof(wrongType, { method: "POST", url: URL_UNDER_TEST, now: NOW })).toEqual({
			ok: false,
			reason: DEVICE_PROOF_REJECTION.MALFORMED,
		})
	})

	it("compares the address without its query and fragment", () => {
		expect(proofUri("https://vulna.example:8443/api/v1/a?b=1#c")).toBe("https://vulna.example:8443/api/v1/a")
	})
})

describe("public key of a device", () => {
	it("derives a stable hardware id and a readable approval fingerprint", () => {
		const key = deviceKey()

		expect(hardwareId(key.jwk)).toBe(hardwareId({ ...key.jwk }))
		expect(hardwareId(key.jwk)).not.toBe(hardwareId(deviceKey().jwk))
		expect(approvalFingerprint(key.jwk)).toMatch(FINGERPRINT)
		expect(approvalFingerprint(key.jwk)).toBe(approvalFingerprint(key.jwk))
	})

	it("accepts only a P-256 public key", () => {
		expect(isPublicKeyJwk({ kty: "EC", crv: "P-256", x: "a", y: "b" })).toBe(true)
		expect(isPublicKeyJwk({ kty: "EC", crv: "P-384", x: "a", y: "b" })).toBe(false)
		expect(isPublicKeyJwk({ kty: "RSA", n: "a", e: "b" })).toBe(false)
		expect(isPublicKeyJwk(null)).toBe(false)
	})
})
