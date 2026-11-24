import { type KeyObject, verify } from "node:crypto"
import type { JsonObject } from "../audit/canonical-json"
import { type PublicKeyJwk, publicKeyOf } from "./public-key"

export const JWS_SIGNATURE_ALGORITHM = {
	ES256: "ES256",
	EDDSA: "EdDSA",
} as const

export const JWS_ALGORITHM = JWS_SIGNATURE_ALGORITHM.ES256

export type JwsSignatureAlgorithm = (typeof JWS_SIGNATURE_ALGORITHM)[keyof typeof JWS_SIGNATURE_ALGORITHM]

const COMPACT_PARTS = 3
const SIGNATURE_ENCODING = "ieee-p1363"
const DIGEST = "sha256"

export interface CompactJws {
	header: JsonObject
	payload: JsonObject
	signingInput: string
	signature: Buffer
}

export function parseCompactJws(token: string): CompactJws | undefined {
	const parts = token.split(".")
	if (parts.length !== COMPACT_PARTS) {
		return undefined
	}
	const [header, payload, signature] = parts as [string, string, string]
	const decodedHeader = decodeSegment(header)
	const decodedPayload = decodeSegment(payload)
	if (decodedHeader === undefined || decodedPayload === undefined) {
		return undefined
	}
	return {
		header: decodedHeader,
		payload: decodedPayload,
		signingInput: `${header}.${payload}`,
		signature: Buffer.from(signature, "base64url"),
	}
}

export function verifyJwsSignature(jws: CompactJws, jwk: PublicKeyJwk): boolean {
	try {
		return verifySignatureWith(jws, publicKeyOf(jwk), JWS_SIGNATURE_ALGORITHM.ES256)
	} catch {
		return false
	}
}

export function verifySignatureWith(jws: CompactJws, key: KeyObject, algorithm: JwsSignatureAlgorithm): boolean {
	const input = Buffer.from(jws.signingInput)
	try {
		if (algorithm === JWS_SIGNATURE_ALGORITHM.EDDSA) {
			return verify(null, input, key, jws.signature)
		}
		return verify(DIGEST, input, { key, dsaEncoding: SIGNATURE_ENCODING }, jws.signature)
	} catch {
		return false
	}
}

function decodeSegment(segment: string): JsonObject | undefined {
	try {
		const value: unknown = JSON.parse(Buffer.from(segment, "base64url").toString("utf8"))
		return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonObject) : undefined
	} catch {
		return undefined
	}
}
