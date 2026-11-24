import type { webcrypto } from "node:crypto"
import { describe, expect, it } from "vitest"
import type { PublicKeyJwk } from "../../native"
import {
	createDeviceProof,
	DPOP_JWS_TYPE,
	JWS_ALGORITHM,
	type JwsSigner,
	proofUri,
	SIGNED_BODY_JWS_TYPE,
} from "../device-proof"
import { createRegistrationRequest, registrationClaims } from "../registration"

const COMPACT_JWS = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const FIXED_TIME = new Date("2026-09-21T10:00:00.000Z")
const FIXED_SECONDS = 1_789_984_800

class WebCryptoSigner implements JwsSigner {
	private identifiers = 0

	private constructor(
		private readonly keyPair: webcrypto.CryptoKeyPair,
		readonly publicKeyJwk: PublicKeyJwk,
	) {}

	static async create(): Promise<WebCryptoSigner> {
		const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])
		const exported = await crypto.subtle.exportKey("jwk", keyPair.publicKey)
		return new WebCryptoSigner(keyPair, { kty: "EC", crv: "P-256", x: exported.x as string, y: exported.y as string })
	}

	async signJws(headerJson: string, payloadJson: string): Promise<string> {
		const signingInput = `${base64Url(headerJson)}.${base64Url(payloadJson)}`
		const signature = await crypto.subtle.sign(
			{ name: "ECDSA", hash: "SHA-256" },
			this.keyPair.privateKey,
			Buffer.from(signingInput),
		)
		return `${signingInput}.${base64Url(Buffer.from(signature))}`
	}

	async randomIdentifier(): Promise<string> {
		this.identifiers += 1
		return `jti-${this.identifiers}`
	}

	async verify(jws: string): Promise<boolean> {
		const [header, payload, signature] = jws.split(".") as [string, string, string]
		return crypto.subtle.verify(
			{ name: "ECDSA", hash: "SHA-256" },
			this.keyPair.publicKey,
			Buffer.from(signature, "base64url"),
			Buffer.from(`${header}.${payload}`),
		)
	}
}

function base64Url(input: string | Buffer): string {
	return Buffer.from(input).toString("base64url")
}

function decodePart(jws: string, index: number): Record<string, unknown> {
	const part = jws.split(".")[index]
	if (part === undefined) {
		throw new Error(`the JWS has no part ${index}`)
	}
	return JSON.parse(Buffer.from(part, "base64url").toString("utf8"))
}

describe("createDeviceProof", () => {
	it("signs a DPoP proof with the device key and the public key in the header", async () => {
		const signer = await WebCryptoSigner.create()

		const proof = await createDeviceProof(
			signer,
			signer.publicKeyJwk,
			{ method: "post", url: "https://vulna.example/api/v1/device/registration?x=1#top" },
			() => FIXED_TIME,
		)

		expect(proof).toMatch(COMPACT_JWS)
		expect(decodePart(proof, 0)).toEqual({ typ: DPOP_JWS_TYPE, alg: JWS_ALGORITHM, jwk: signer.publicKeyJwk })
		expect(decodePart(proof, 1)).toEqual({
			jti: "jti-1",
			htm: "POST",
			htu: "https://vulna.example/api/v1/device/registration",
			iat: FIXED_SECONDS,
		})
		expect(await signer.verify(proof)).toBe(true)
	})

	it("adds the server nonce and the token hash only when they are given", async () => {
		const signer = await WebCryptoSigner.create()

		const proof = await createDeviceProof(
			signer,
			signer.publicKeyJwk,
			{ method: "GET", url: "https://vulna.example/api/v1/queue", nonce: "n-1", accessTokenHash: "h-1" },
			() => FIXED_TIME,
		)

		expect(decodePart(proof, 1)).toMatchObject({ nonce: "n-1", ath: "h-1" })
	})

	it("uses a fresh identifier for every proof", async () => {
		const signer = await WebCryptoSigner.create()
		const input = { method: "GET", url: "https://vulna.example/api/v1/queue" }

		const first = await createDeviceProof(signer, signer.publicKeyJwk, input, () => FIXED_TIME)
		const second = await createDeviceProof(signer, signer.publicKeyJwk, input, () => FIXED_TIME)

		expect(decodePart(first, 1).jti).not.toBe(decodePart(second, 1).jti)
	})

	it("strips the query and the fragment from the proof address", () => {
		expect(proofUri("https://vulna.example:8443/api/v1/a?b=1#c")).toBe("https://vulna.example:8443/api/v1/a")
	})
})

describe("createRegistrationRequest", () => {
	const input = {
		descriptor: { model: "iPhone15,2", osVersion: "18.5", platform: "ios" as const },
		secureHardware: "secure_enclave" as const,
		managedConfiguration: false,
	}

	it("signs the registration claims as a compact JWS with the same device key", async () => {
		const signer = await WebCryptoSigner.create()

		const request = await createRegistrationRequest(signer, input, () => FIXED_TIME)

		expect(request.jws).toMatch(COMPACT_JWS)
		expect(decodePart(request.jws, 0)).toEqual({ alg: JWS_ALGORITHM, typ: SIGNED_BODY_JWS_TYPE })
		expect(decodePart(request.jws, 1)).toEqual({
			model: "iPhone15,2",
			os_version: "18.5",
			platform: "ios",
			secure_hardware: "secure_enclave",
			managed_configuration: false,
			iat: FIXED_SECONDS,
		})
		expect(await signer.verify(request.jws)).toBe(true)
	})

	it("carries the managed configuration claims only when the device has them", () => {
		const claims = registrationClaims(
			{
				...input,
				managedConfiguration: true,
				registrationSecret: "secret",
				groupCode: "ambulance",
				blockedPredecessorHwId: "hw-old",
			},
			FIXED_TIME,
		)

		expect(claims).toMatchObject({
			managed_configuration: true,
			registration_secret: "secret",
			group_code: "ambulance",
			blocked_predecessor_hw_id: "hw-old",
		})
		expect(Object.keys(registrationClaims(input, FIXED_TIME))).not.toContain("registration_secret")
	})
})
