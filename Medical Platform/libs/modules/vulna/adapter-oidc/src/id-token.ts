import { constants, type KeyObject, verify } from "node:crypto"

const ID_TOKEN_ALGORITHM = {
	RS256: "RS256",
	PS256: "PS256",
	ES256: "ES256",
} as const

export type IdTokenAlgorithm = (typeof ID_TOKEN_ALGORITHM)[keyof typeof ID_TOKEN_ALGORITHM]

export interface IdTokenClaims {
	subject: string
	authTime: number | undefined
	all: Readonly<Record<string, unknown>>
}

export interface IdTokenExpectation {
	issuer: string
	clientId: string
	nonce: string | undefined
	now: Date
	keyOf: (kid: string | undefined, algorithm: IdTokenAlgorithm) => Promise<KeyObject | undefined>
}

export class IdTokenError extends Error {}

const COMPACT_PARTS = 3
const DIGEST = "sha256"
const ES256_ENCODING = "ieee-p1363"
const PSS_PADDING = { padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: constants.RSA_PSS_SALTLEN_DIGEST }
const MILLISECONDS_PER_SECOND = 1000
const CLOCK_SKEW_TOLERANCE_SECONDS = 60

interface ParsedToken {
	header: Record<string, unknown>
	payload: Record<string, unknown>
	signingInput: Buffer
	signature: Buffer
}

export async function verifyIdToken(token: string, expectation: IdTokenExpectation): Promise<IdTokenClaims> {
	const parsed = parse(token)
	const algorithm = algorithmOf(parsed.header.alg)
	const kid = typeof parsed.header.kid === "string" ? parsed.header.kid : undefined
	const key = await expectation.keyOf(kid, algorithm)
	if (key === undefined) {
		throw new IdTokenError(`no provider key for kid ${kid ?? "(none)"} and ${algorithm}`)
	}
	if (!verifySignature(parsed, key, algorithm)) {
		throw new IdTokenError("the ID token signature is invalid")
	}
	return claimsOf(parsed.payload, expectation)
}

export function keyTypeOf(algorithm: IdTokenAlgorithm): string {
	return algorithm === ID_TOKEN_ALGORITHM.ES256 ? "EC" : "RSA"
}

function parse(token: string): ParsedToken {
	const parts = token.split(".")
	if (parts.length !== COMPACT_PARTS) {
		throw new IdTokenError("the ID token is not a compact JWS")
	}
	const [header, payload, signature] = parts as [string, string, string]
	return {
		header: decodeObject(header),
		payload: decodeObject(payload),
		signingInput: Buffer.from(`${header}.${payload}`),
		signature: Buffer.from(signature, "base64url"),
	}
}

function decodeObject(segment: string): Record<string, unknown> {
	let value: unknown
	try {
		value = JSON.parse(Buffer.from(segment, "base64url").toString("utf8"))
	} catch {
		throw new IdTokenError("the ID token segment is not JSON")
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new IdTokenError("the ID token segment is not an object")
	}
	return value as Record<string, unknown>
}

function algorithmOf(value: unknown): IdTokenAlgorithm {
	const algorithm = Object.values(ID_TOKEN_ALGORITHM).find((candidate) => candidate === value)
	if (algorithm === undefined) {
		throw new IdTokenError(`unsupported ID token algorithm ${String(value)}`)
	}
	return algorithm
}

function verifySignature(parsed: ParsedToken, key: KeyObject, algorithm: IdTokenAlgorithm): boolean {
	try {
		switch (algorithm) {
			case ID_TOKEN_ALGORITHM.RS256:
				return verify(DIGEST, parsed.signingInput, key, parsed.signature)
			case ID_TOKEN_ALGORITHM.PS256:
				return verify(DIGEST, parsed.signingInput, { key, ...PSS_PADDING }, parsed.signature)
			case ID_TOKEN_ALGORITHM.ES256:
				return verify(DIGEST, parsed.signingInput, { key, dsaEncoding: ES256_ENCODING }, parsed.signature)
			default:
				return algorithm satisfies never
		}
	} catch {
		return false
	}
}

function claimsOf(payload: Record<string, unknown>, expectation: IdTokenExpectation): IdTokenClaims {
	const { iss, sub, aud, exp, azp, nonce, auth_time } = payload
	if (iss !== expectation.issuer) {
		throw new IdTokenError("the ID token issuer differs from the configured one")
	}
	if (typeof sub !== "string" || sub.length === 0) {
		throw new IdTokenError("the ID token carries no subject")
	}
	if (
		!isAudience(aud, expectation.clientId) ||
		(Array.isArray(aud) && aud.length > 1 && azp !== expectation.clientId)
	) {
		throw new IdTokenError("the ID token is not for this client")
	}
	const nowSeconds = Math.floor(expectation.now.getTime() / MILLISECONDS_PER_SECOND)
	if (typeof exp !== "number" || exp + CLOCK_SKEW_TOLERANCE_SECONDS <= nowSeconds) {
		throw new IdTokenError("the ID token has expired")
	}
	if (expectation.nonce !== undefined && nonce !== expectation.nonce) {
		throw new IdTokenError("the ID token nonce does not match the flow")
	}
	return { subject: sub, authTime: typeof auth_time === "number" ? auth_time : undefined, all: payload }
}

function isAudience(aud: unknown, clientId: string): boolean {
	return aud === clientId || (Array.isArray(aud) && aud.includes(clientId))
}
