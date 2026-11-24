import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto"
import { describe, expect, it } from "vitest"
import { JWS_ALGORITHM } from "../jws"
import { hardwareId, type PublicKeyJwk } from "../public-key"
import {
	DEVICE_STATE,
	REGISTRATION_REJECTION,
	type RegistrationClaims,
	registrationGroupCode,
	registrationState,
	verifyRegistrationBody,
} from "../registration"

const NOW = new Date("2026-09-22T10:00:00.000Z")
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000)
const SECRET = "mdm-secret"

interface TestKey {
	privateKey: KeyObject
	jwk: PublicKeyJwk
}

function deviceKey(): TestKey {
	const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
	const exported = publicKey.export({ format: "jwk" })
	return { privateKey, jwk: { kty: "EC", crv: "P-256", x: exported.x as string, y: exported.y as string } }
}

function registrationJws(key: KeyObject, claims: Record<string, unknown> = {}): string {
	const header = Buffer.from(JSON.stringify({ alg: JWS_ALGORITHM, typ: "JWT" })).toString("base64url")
	const payload = Buffer.from(
		JSON.stringify({
			model: "iPhone15,2",
			os_version: "18.5",
			platform: "ios",
			secure_hardware: "secure_enclave",
			managed_configuration: false,
			iat: NOW_SECONDS,
			...claims,
		}),
	).toString("base64url")
	const signature = createSign("sha256").update(`${header}.${payload}`).sign({ key, dsaEncoding: "ieee-p1363" })
	return `${header}.${payload}.${signature.toString("base64url")}`
}

function claimsOf(overrides: Partial<RegistrationClaims> = {}): RegistrationClaims {
	return {
		model: "iPhone15,2",
		osVersion: "18.5",
		platform: "ios",
		secureHardware: "secure_enclave",
		managedConfiguration: false,
		registrationSecret: undefined,
		groupCode: undefined,
		blockedPredecessorHwId: undefined,
		issuedAt: NOW_SECONDS,
		...overrides,
	}
}

describe("verifyRegistrationBody", () => {
	it("accepts a body signed by the key of the device proof", () => {
		const key = deviceKey()

		const verdict = verifyRegistrationBody(registrationJws(key.privateKey), key.jwk, NOW)

		expect(verdict).toEqual({
			ok: true,
			claims: claimsOf({ registrationSecret: undefined, groupCode: undefined }),
		})
	})

	it("CAP-006-S05 takes a device with no secure element and keeps that on its record", () => {
		const key = deviceKey()

		const verdict = verifyRegistrationBody(
			registrationJws(key.privateKey, { secure_hardware: "keystore" }),
			key.jwk,
			NOW,
		)

		expect(verdict).toEqual({ ok: true, claims: claimsOf({ secureHardware: "keystore" }) })
	})

	it("CAP-006-S10 rejects a body signed by another key than the proof carries", () => {
		const device = deviceKey()
		const intruder = deviceKey()

		const verdict = verifyRegistrationBody(registrationJws(intruder.privateKey), device.jwk, NOW)

		expect(verdict).toEqual({ ok: false, reason: REGISTRATION_REJECTION.KEY_MISMATCH })
	})

	it("rejects a body issued outside the clock skew tolerance", () => {
		const key = deviceKey()

		const verdict = verifyRegistrationBody(registrationJws(key.privateKey, { iat: NOW_SECONDS - 61 }), key.jwk, NOW)

		expect(verdict).toEqual({ ok: false, reason: REGISTRATION_REJECTION.STALE })
	})

	it("rejects a body without the claims the registration needs", () => {
		const key = deviceKey()

		expect(verifyRegistrationBody(registrationJws(key.privateKey, { platform: "windows" }), key.jwk, NOW)).toEqual({
			ok: false,
			reason: REGISTRATION_REJECTION.MALFORMED,
		})
		expect(verifyRegistrationBody("not-a-token", key.jwk, NOW)).toEqual({
			ok: false,
			reason: REGISTRATION_REJECTION.MALFORMED,
		})
	})

	it("reads the optional managed configuration claims", () => {
		const key = deviceKey()
		const jws = registrationJws(key.privateKey, {
			managed_configuration: true,
			registration_secret: SECRET,
			group_code: "ambulance",
			blocked_predecessor_hw_id: "hw-old",
		})

		expect(verifyRegistrationBody(jws, key.jwk, NOW)).toMatchObject({
			ok: true,
			claims: {
				managedConfiguration: true,
				registrationSecret: SECRET,
				groupCode: "ambulance",
				blockedPredecessorHwId: "hw-old",
			},
		})
	})
})

describe("registrationState", () => {
	it("CAP-006-S02 leaves a device without the registration secret waiting for the administrator", () => {
		expect(registrationState(claimsOf(), SECRET)).toBe(DEVICE_STATE.PENDING_APPROVAL)
	})

	it("CAP-006-S01 approves a device that proves the registration secret of the managed configuration", () => {
		expect(registrationState(claimsOf({ registrationSecret: SECRET, managedConfiguration: true }), SECRET)).toBe(
			DEVICE_STATE.APPROVED,
		)
	})

	it("leaves a device claiming managed configuration without the secret waiting", () => {
		expect(registrationState(claimsOf({ managedConfiguration: true }), SECRET)).toBe(DEVICE_STATE.PENDING_APPROVAL)
		expect(registrationState(claimsOf({ registrationSecret: "wrong" }), SECRET)).toBe(DEVICE_STATE.PENDING_APPROVAL)
		expect(registrationState(claimsOf({ registrationSecret: SECRET }), undefined)).toBe(DEVICE_STATE.PENDING_APPROVAL)
	})

	it("CAP-006-S06 makes a reinstalled application register again as a new device", () => {
		const original = deviceKey()
		const reinstalled = deviceKey()

		expect(hardwareId(reinstalled.jwk)).not.toBe(hardwareId(original.jwk))
		expect(registrationState(claimsOf({}), undefined)).toBe(DEVICE_STATE.PENDING_APPROVAL)
	})

	it("CAP-006-S13 leaves a registration after a block waiting even with the registration secret", () => {
		const claims = claimsOf({ registrationSecret: SECRET, blockedPredecessorHwId: "hw-old" })

		expect(registrationState(claims, SECRET)).toBe(DEVICE_STATE.PENDING_APPROVAL)
	})
})

describe("registrationGroupCode", () => {
	it("CAP-006-S11 takes the group of a device that proved the registration secret", () => {
		expect(registrationGroupCode(claimsOf({ registrationSecret: SECRET, groupCode: "ambulance" }), SECRET)).toBe(
			"ambulance",
		)
	})

	it("CAP-006-S12 ignores the group of a device that did not prove the registration secret", () => {
		expect(registrationGroupCode(claimsOf({ groupCode: "ambulance" }), SECRET)).toBeNull()
		expect(registrationGroupCode(claimsOf({ registrationSecret: SECRET }), SECRET)).toBeNull()
	})
})
