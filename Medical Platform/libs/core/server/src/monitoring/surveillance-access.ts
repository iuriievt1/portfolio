import { createHash, timingSafeEqual } from "node:crypto"
import { WWW_AUTHENTICATE_HEADER } from "@ansora/contracts"

export const SURVEILLANCE_ACCESS = {
	GRANTED: "granted",
	UNAUTHENTICATED: "unauthenticated",
	NOT_EXPOSED: "not_exposed",
} as const

export type SurveillanceAccess = (typeof SURVEILLANCE_ACCESS)[keyof typeof SURVEILLANCE_ACCESS]

export interface SurveillanceRefusal {
	status: number
	headers: Readonly<Record<string, string>>
}

export interface SurveillanceRequest {
	authorization: string | undefined
	isReservedInterface: boolean
}

const BEARER_CHALLENGE = "Bearer"
const BEARER_PREFIX = `${BEARER_CHALLENGE.toLowerCase()} `
const UNAUTHORIZED = 401
const NOT_FOUND = 404

const SURVEILLANCE_TOKEN_MIN_LENGTH = 32

function digestOf(text: string): Buffer {
	return createHash("sha256").update(text).digest()
}

function presentsToken(authorization: string | undefined, token: string): boolean {
	if (authorization === undefined || !authorization.toLowerCase().startsWith(BEARER_PREFIX)) {
		return false
	}
	return timingSafeEqual(digestOf(authorization.slice(BEARER_PREFIX.length)), digestOf(token))
}

// CAP-028-R08, CAP-028-S05, Q-058
export function surveillanceAccessOf(request: SurveillanceRequest, token: string | undefined): SurveillanceAccess {
	if (token !== undefined) {
		return presentsToken(request.authorization, token)
			? SURVEILLANCE_ACCESS.GRANTED
			: SURVEILLANCE_ACCESS.UNAUTHENTICATED
	}
	return request.isReservedInterface ? SURVEILLANCE_ACCESS.GRANTED : SURVEILLANCE_ACCESS.NOT_EXPOSED
}

// CAP-028-R08, NAB-465
export function surveillanceTokenOf(configured: string | undefined): string | undefined {
	if (configured === undefined) {
		return undefined
	}
	if (configured.length < SURVEILLANCE_TOKEN_MIN_LENGTH) {
		throw new Error(`The surveillance token must have at least ${SURVEILLANCE_TOKEN_MIN_LENGTH} characters`)
	}
	return configured
}

// CAP-028-S05
export function surveillanceRefusalOf(access: SurveillanceAccess): SurveillanceRefusal | undefined {
	switch (access) {
		case SURVEILLANCE_ACCESS.GRANTED:
			return undefined
		case SURVEILLANCE_ACCESS.UNAUTHENTICATED:
			return { status: UNAUTHORIZED, headers: { [WWW_AUTHENTICATE_HEADER]: BEARER_CHALLENGE } }
		case SURVEILLANCE_ACCESS.NOT_EXPOSED:
			return { status: NOT_FOUND, headers: {} }
		default:
			return access satisfies never
	}
}
