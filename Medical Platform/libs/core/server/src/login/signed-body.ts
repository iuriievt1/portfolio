import { isFresh } from "../device/device-proof"
import { type CompactJws, JWS_ALGORITHM, parseCompactJws, verifyJwsSignature } from "../device/jws"
import type { PublicKeyJwk } from "../device/public-key"
import { optionalText } from "../text"

export const SIGNED_BODY_REJECTION = {
	MALFORMED: "malformed",
	SIGNATURE_INVALID: "signature-invalid",
	STALE: "stale",
} as const

export type SignedBodyRejection = (typeof SIGNED_BODY_REJECTION)[keyof typeof SIGNED_BODY_REJECTION]

export interface SignedBodyClaims {
	challengeId: string
	value: string
	identifier: string
	bindingCode: string | undefined
	issuedAt: number
}

export interface AcceptedSignedBody {
	ok: true
	claims: SignedBodyClaims
}

export interface RejectedSignedBody {
	ok: false
	reason: SignedBodyRejection
}

export type SignedBodyVerdict = AcceptedSignedBody | RejectedSignedBody

export function verifySignedBody(body: string, deviceKey: PublicKeyJwk, now: Date): SignedBodyVerdict {
	const jws = parseCompactJws(body)
	if (jws === undefined || jws.header.alg !== JWS_ALGORITHM) {
		return { ok: false, reason: SIGNED_BODY_REJECTION.MALFORMED }
	}
	if (!verifyJwsSignature(jws, deviceKey)) {
		return { ok: false, reason: SIGNED_BODY_REJECTION.SIGNATURE_INVALID }
	}
	const claims = signedBodyClaims(jws)
	if (claims === undefined) {
		return { ok: false, reason: SIGNED_BODY_REJECTION.MALFORMED }
	}
	if (!isFresh(claims.issuedAt, now)) {
		return { ok: false, reason: SIGNED_BODY_REJECTION.STALE }
	}
	return { ok: true, claims }
}

function signedBodyClaims(jws: CompactJws): SignedBodyClaims | undefined {
	const { challenge_id, value, identifier, binding_code, iat } = jws.payload
	const challengeId = optionalText(challenge_id)
	const challengeValue = optionalText(value)
	const carrier = optionalText(identifier)
	const bindingCode = optionalText(binding_code)
	if (challengeId === undefined || challengeValue === undefined || carrier === undefined || typeof iat !== "number") {
		return undefined
	}
	if (binding_code !== undefined && bindingCode === undefined) {
		return undefined
	}
	return { challengeId, value: challengeValue, identifier: carrier, bindingCode, issuedAt: iat }
}
