import { createPublicKey, type KeyObject } from "node:crypto"
import { isFresh } from "../device/device-proof"
import {
	type CompactJws,
	JWS_SIGNATURE_ALGORITHM,
	type JwsSignatureAlgorithm,
	parseCompactJws,
	verifySignatureWith,
} from "../device/jws"
import { hardwareId, type PublicKeyJwk } from "../device/public-key"

const EC_KEY_TYPE = "EC"
const P256_CURVE = "P-256"
const OKP_KEY_TYPE = "OKP"
const ED25519_CURVE = "Ed25519"
const PRIVATE_KEY_MEMBER = "d"

export interface EcPinPublicKey {
	kty: typeof EC_KEY_TYPE
	crv: typeof P256_CURVE
	x: string
	y: string
}

export interface EdPinPublicKey {
	kty: typeof OKP_KEY_TYPE
	crv: typeof ED25519_CURVE
	x: string
}

export type PinPublicKeyJwk = EcPinPublicKey | EdPinPublicKey

export const PIN_PROOF_REJECTION = {
	SIGNATURE_INVALID: "signature-invalid",
	DEVICE_MISMATCH: "device-mismatch",
	PERSONAL_NUMBER_MISMATCH: "personal-number-mismatch",
	STALE: "stale",
} as const

export type PinProofRejection = (typeof PIN_PROOF_REJECTION)[keyof typeof PIN_PROOF_REJECTION]

export interface PinProofClaims {
	challengeId: string
	value: string
	personalNumber: string
	deviceKeyThumbprint: string
	issuedAt: number
}

export interface ParsedPinProof {
	jws: CompactJws
	algorithm: JwsSignatureAlgorithm
	claims: PinProofClaims
}

export interface PinProofExpectation {
	deviceKey: PublicKeyJwk
	personalNumber: string
	now: Date
}

export interface AcceptedPinProof {
	ok: true
}

export interface RejectedPinProof {
	ok: false
	reason: PinProofRejection
}

export type PinProofVerdict = AcceptedPinProof | RejectedPinProof

export function parsePinProof(proof: string): ParsedPinProof | undefined {
	const jws = parseCompactJws(proof)
	if (jws === undefined) {
		return undefined
	}
	const algorithm = signatureAlgorithm(jws.header.alg)
	const claims = algorithm === undefined ? undefined : pinProofClaims(jws)
	if (algorithm === undefined || claims === undefined) {
		return undefined
	}
	return { jws, algorithm, claims }
}

export function verifyPinProof(
	proof: ParsedPinProof,
	pinKey: PinPublicKeyJwk,
	expectation: PinProofExpectation,
): PinProofVerdict {
	if (
		proof.algorithm !== algorithmOf(pinKey) ||
		!verifySignatureWith(proof.jws, keyObjectOf(pinKey), proof.algorithm)
	) {
		return { ok: false, reason: PIN_PROOF_REJECTION.SIGNATURE_INVALID }
	}
	if (proof.claims.deviceKeyThumbprint !== hardwareId(expectation.deviceKey)) {
		return { ok: false, reason: PIN_PROOF_REJECTION.DEVICE_MISMATCH }
	}
	if (proof.claims.personalNumber !== expectation.personalNumber) {
		return { ok: false, reason: PIN_PROOF_REJECTION.PERSONAL_NUMBER_MISMATCH }
	}
	if (!isFresh(proof.claims.issuedAt, expectation.now)) {
		return { ok: false, reason: PIN_PROOF_REJECTION.STALE }
	}
	return { ok: true }
}

export function parsePinPublicKey(setup: string): PinPublicKeyJwk | undefined {
	let parsed: unknown
	try {
		parsed = JSON.parse(setup)
	} catch {
		return undefined
	}
	const key = asPinPublicKey(parsed)
	if (key === undefined) {
		return undefined
	}
	try {
		keyObjectOf(key)
	} catch {
		return undefined
	}
	return key
}

function asPinPublicKey(value: unknown): PinPublicKeyJwk | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return undefined
	}
	const candidate = value as Record<string, unknown>
	if (PRIVATE_KEY_MEMBER in candidate || typeof candidate.x !== "string") {
		return undefined
	}
	if (candidate.kty === EC_KEY_TYPE && candidate.crv === P256_CURVE && typeof candidate.y === "string") {
		return { kty: EC_KEY_TYPE, crv: P256_CURVE, x: candidate.x, y: candidate.y }
	}
	if (candidate.kty === OKP_KEY_TYPE && candidate.crv === ED25519_CURVE) {
		return { kty: OKP_KEY_TYPE, crv: ED25519_CURVE, x: candidate.x }
	}
	return undefined
}

function algorithmOf(key: PinPublicKeyJwk): JwsSignatureAlgorithm {
	return key.kty === EC_KEY_TYPE ? JWS_SIGNATURE_ALGORITHM.ES256 : JWS_SIGNATURE_ALGORITHM.EDDSA
}

function keyObjectOf(key: PinPublicKeyJwk): KeyObject {
	return createPublicKey({ key: { ...key }, format: "jwk" })
}

function signatureAlgorithm(value: unknown): JwsSignatureAlgorithm | undefined {
	return Object.values(JWS_SIGNATURE_ALGORITHM).find((algorithm) => algorithm === value)
}

function pinProofClaims(jws: CompactJws): PinProofClaims | undefined {
	const { challenge_id, value, personal_number, jkt, iat } = jws.payload
	if (
		typeof challenge_id !== "string" ||
		typeof value !== "string" ||
		typeof personal_number !== "string" ||
		typeof jkt !== "string" ||
		typeof iat !== "number"
	) {
		return undefined
	}
	return { challengeId: challenge_id, value, personalNumber: personal_number, deviceKeyThumbprint: jkt, issuedAt: iat }
}
