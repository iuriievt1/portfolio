import { MILLISECONDS_PER_SECOND } from "../login/secret"
import { type CompactJws, JWS_ALGORITHM, parseCompactJws, verifyJwsSignature } from "./jws"
import { isPublicKeyJwk, type PublicKeyJwk } from "./public-key"

export const DEVICE_PROOF_TYPE = "dpop+jwt"
export const CLOCK_SKEW_TOLERANCE_SECONDS = 60

export const DEVICE_PROOF_REJECTION = {
	MALFORMED: "malformed",
	SIGNATURE_INVALID: "signature-invalid",
	KEY_MISMATCH: "key-mismatch",
	REQUEST_MISMATCH: "request-mismatch",
	STALE: "stale",
	REPLAYED: "replayed",
} as const

export type DeviceProofRejection = (typeof DEVICE_PROOF_REJECTION)[keyof typeof DEVICE_PROOF_REJECTION]

export interface DeviceProofExpectation {
	method: string
	url: string
	now: Date
	knownKey?: PublicKeyJwk
	accessTokenHash?: string
	isReplayed?: (jti: string) => boolean
}

export interface AcceptedDeviceProof {
	ok: true
	jwk: PublicKeyJwk
	jti: string
	issuedAt: number
	nonce: string | undefined
}

export interface RejectedDeviceProof {
	ok: false
	reason: DeviceProofRejection
}

export type DeviceProofVerdict = AcceptedDeviceProof | RejectedDeviceProof

export function verifyDeviceProof(proof: string, expectation: DeviceProofExpectation): DeviceProofVerdict {
	const jws = parseCompactJws(proof)
	if (jws === undefined || !hasProofHeader(jws)) {
		return rejected(DEVICE_PROOF_REJECTION.MALFORMED)
	}
	const jwk = jws.header.jwk
	if (!isPublicKeyJwk(jwk)) {
		return rejected(DEVICE_PROOF_REJECTION.MALFORMED)
	}
	const claims = proofClaims(jws)
	if (claims === undefined) {
		return rejected(DEVICE_PROOF_REJECTION.MALFORMED)
	}
	if (expectation.knownKey !== undefined && !sameKey(jwk, expectation.knownKey)) {
		return rejected(DEVICE_PROOF_REJECTION.KEY_MISMATCH)
	}
	if (!verifyJwsSignature(jws, jwk)) {
		return rejected(DEVICE_PROOF_REJECTION.SIGNATURE_INVALID)
	}
	if (claims.htm !== expectation.method.toUpperCase() || claims.htu !== proofUri(expectation.url)) {
		return rejected(DEVICE_PROOF_REJECTION.REQUEST_MISMATCH)
	}
	if (expectation.accessTokenHash !== undefined && claims.ath !== expectation.accessTokenHash) {
		return rejected(DEVICE_PROOF_REJECTION.REQUEST_MISMATCH)
	}
	if (!isFresh(claims.iat, expectation.now)) {
		return rejected(DEVICE_PROOF_REJECTION.STALE)
	}
	if (expectation.isReplayed?.(claims.jti) === true) {
		return rejected(DEVICE_PROOF_REJECTION.REPLAYED)
	}
	return { ok: true, jwk, jti: claims.jti, issuedAt: claims.iat, nonce: claims.nonce }
}

export function proofUri(url: string): string {
	const parsed = new URL(url)
	return `${parsed.origin}${parsed.pathname}`
}

export function isFresh(issuedAt: number, now: Date): boolean {
	return Math.abs(Math.floor(now.getTime() / MILLISECONDS_PER_SECOND) - issuedAt) <= CLOCK_SKEW_TOLERANCE_SECONDS
}

export function sameKey(left: PublicKeyJwk, right: PublicKeyJwk): boolean {
	return left.crv === right.crv && left.kty === right.kty && left.x === right.x && left.y === right.y
}

interface ProofClaims {
	htm: string
	htu: string
	jti: string
	iat: number
	nonce: string | undefined
	ath: string | undefined
}

function hasProofHeader(jws: CompactJws): boolean {
	return jws.header.typ === DEVICE_PROOF_TYPE && jws.header.alg === JWS_ALGORITHM
}

function proofClaims(jws: CompactJws): ProofClaims | undefined {
	const { htm, htu, jti, iat, nonce, ath } = jws.payload
	if (typeof htm !== "string" || typeof htu !== "string" || typeof jti !== "string" || typeof iat !== "number") {
		return undefined
	}
	return {
		htm,
		htu,
		jti,
		iat,
		nonce: typeof nonce === "string" ? nonce : undefined,
		ath: typeof ath === "string" ? ath : undefined,
	}
}

function rejected(reason: DeviceProofRejection): RejectedDeviceProof {
	return { ok: false, reason }
}
