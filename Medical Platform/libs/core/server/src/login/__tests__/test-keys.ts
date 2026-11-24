import { createSign, generateKeyPairSync, type KeyObject, sign } from "node:crypto"
import type { PublicKeyJwk } from "../../device/public-key"
import type { PinPublicKeyJwk } from "../pin-proof"

export interface TestDeviceKey {
	privateKey: KeyObject
	jwk: PublicKeyJwk
}

export interface TestPinKey {
	privateKey: KeyObject
	jwk: PinPublicKeyJwk
	algorithm: "ES256" | "EdDSA"
}

export function deviceKey(): TestDeviceKey {
	const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
	const exported = publicKey.export({ format: "jwk" })
	return { privateKey, jwk: { kty: "EC", crv: "P-256", x: exported.x as string, y: exported.y as string } }
}

export function ecPinKey(): TestPinKey {
	const { privateKey, jwk } = deviceKey()
	return { privateKey, jwk, algorithm: "ES256" }
}

export function edPinKey(): TestPinKey {
	const { privateKey, publicKey } = generateKeyPairSync("ed25519")
	const exported = publicKey.export({ format: "jwk" })
	return { privateKey, jwk: { kty: "OKP", crv: "Ed25519", x: exported.x as string }, algorithm: "EdDSA" }
}

export function compactJws(key: KeyObject, algorithm: "ES256" | "EdDSA", payload: object, typ = "JWT"): string {
	const header = base64Url({ alg: algorithm, typ })
	const body = base64Url(payload)
	const input = Buffer.from(`${header}.${body}`)
	const signature =
		algorithm === "EdDSA"
			? sign(null, input, key)
			: createSign("sha256").update(input).sign({ key, dsaEncoding: "ieee-p1363" })
	return `${header}.${body}.${signature.toString("base64url")}`
}

export function base64Url(value: object): string {
	return Buffer.from(JSON.stringify(value)).toString("base64url")
}
