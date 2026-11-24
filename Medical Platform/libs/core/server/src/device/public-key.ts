import { createHash, createPublicKey, type KeyObject } from "node:crypto"

const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const FINGERPRINT_BITS = 50
const FINGERPRINT_GROUP = 5
const BITS_PER_CHARACTER = 5

export interface PublicKeyJwk {
	kty: "EC"
	crv: "P-256"
	x: string
	y: string
}

export function isPublicKeyJwk(value: unknown): value is PublicKeyJwk {
	if (typeof value !== "object" || value === null) {
		return false
	}
	const candidate = value as Record<string, unknown>
	return (
		candidate.kty === "EC" &&
		candidate.crv === "P-256" &&
		typeof candidate.x === "string" &&
		typeof candidate.y === "string"
	)
}

export function publicKeyOf(jwk: PublicKeyJwk): KeyObject {
	return createPublicKey({ key: { ...jwk }, format: "jwk" })
}

export function hardwareId(jwk: PublicKeyJwk): string {
	const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })
	return createHash("sha256").update(canonical).digest("base64url")
}

export function approvalFingerprint(jwk: PublicKeyJwk): string {
	const spki = publicKeyOf(jwk).export({ type: "spki", format: "der" })
	const digest = createHash("sha256").update(spki).digest()
	const characters = crockfordBase32(digest, FINGERPRINT_BITS)
	return `${characters.slice(0, FINGERPRINT_GROUP)}-${characters.slice(FINGERPRINT_GROUP)}`
}

function crockfordBase32(digest: Buffer, bits: number): string {
	let out = ""
	for (let bit = 0; bit < bits; bit += BITS_PER_CHARACTER) {
		out += CROCKFORD_ALPHABET[readBits(digest, bit, BITS_PER_CHARACTER)]
	}
	return out
}

function readBits(digest: Buffer, offset: number, count: number): number {
	let value = 0
	for (let index = 0; index < count; index++) {
		const bit = offset + index
		const byte = digest[bit >> 3] ?? 0
		value = (value << 1) | ((byte >> (7 - (bit & 7))) & 1)
	}
	return value
}
