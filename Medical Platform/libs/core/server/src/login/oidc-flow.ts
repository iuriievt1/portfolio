import { LOGIN_RETURN_PARAMETER, LOGIN_RETURN_URL } from "@ansora/contracts"
import { CLOCK_SKEW_TOLERANCE_SECONDS } from "../device/device-proof"
import { optionalText } from "../text"
import { MILLISECONDS_PER_SECOND, randomSecret, sha256Base64url } from "./secret"

export const OIDC_FLOW_LIFETIME_SECONDS = 600
export const COMPLETION_CODE_LIFETIME_SECONDS = 300

export interface PkcePair {
	codeVerifier: string
	codeChallenge: string
}

export function newPkcePair(): PkcePair {
	const codeVerifier = randomSecret()
	return { codeVerifier, codeChallenge: sha256Base64url(codeVerifier) }
}

export function appReturnUrl(state: string, completionCode: string): string {
	const url = new URL(LOGIN_RETURN_URL)
	url.searchParams.set(LOGIN_RETURN_PARAMETER.STATE, state)
	url.searchParams.set(LOGIN_RETURN_PARAMETER.COMPLETION_CODE, completionCode)
	return url.toString()
}

export function isAuthenticationFresh(authTime: number | undefined, flowStartedAt: Date): boolean {
	if (authTime === undefined) {
		return false
	}
	return authTime >= Math.floor(flowStartedAt.getTime() / MILLISECONDS_PER_SECOND) - CLOCK_SKEW_TOLERANCE_SECONDS
}

export function personalNumberOf(claims: Readonly<Record<string, unknown>>, claimName: string): string | undefined {
	const value = claims[claimName]
	if (typeof value === "number" && Number.isInteger(value)) {
		return String(value)
	}
	return optionalText(value)
}
