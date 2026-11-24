import { secondsAfter, sha256Base64url } from "./secret"

export const SESSION_OUTCOME = {
	CREATED: "created",
	RESUMED: "resumed",
} as const

export type SessionOutcome = (typeof SESSION_OUTCOME)[keyof typeof SESSION_OUTCOME]

export const SESSION_END_REASON = {
	LOGOUT: "logout",
	EXPIRED: "expired",
	REPLACED: "replaced",
	ATTEMPTS_EXHAUSTED: "attempts_exhausted",
	PROVIDER_REJECTED: "provider_rejected",
	USER_REVOKED: "user_revoked",
	DEVICE_REVOKED: "device_revoked",
} as const

export type SessionEndReason = (typeof SESSION_END_REASON)[keyof typeof SESSION_END_REASON]

export interface SessionPolicy {
	sessionMaxSeconds: number
	tokenValiditySeconds: number
}

export function accessTokenHash(token: string): string {
	return sha256Base64url(token)
}

export function tokenExpiresAt(now: Date, sessionEnd: Date, policy: SessionPolicy): Date {
	const byPolicy = secondsAfter(now, policy.tokenValiditySeconds)
	return byPolicy < sessionEnd ? byPolicy : sessionEnd
}

export interface SessionLifetime {
	endedAt: Date | null
	sessionEnd: Date
}

export function isSessionActive(session: SessionLifetime, now: Date): boolean {
	return session.endedAt === null && session.sessionEnd.getTime() > now.getTime()
}

export function isTokenActive(token: { tokenExpiresAt: Date }, now: Date): boolean {
	return token.tokenExpiresAt.getTime() > now.getTime()
}
