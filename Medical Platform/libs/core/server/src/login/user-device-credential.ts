import type { PinPublicKeyJwk } from "./pin-proof"
import { secondsAfter } from "./secret"

export interface UserDeviceCredential {
	pinPublicKey: PinPublicKeyJwk | null
	blockedAt: Date | null
	lastFullLoginAt: Date | null
}

export const FULL_LOGIN_REASON = {
	NEVER_SIGNED_IN: "never_signed_in",
	BLOCKED: "blocked",
	INTERVAL_EXPIRED: "interval_expired",
} as const

export type FullLoginReason = (typeof FULL_LOGIN_REASON)[keyof typeof FULL_LOGIN_REASON]

export function fullLoginRequirement(
	credential: UserDeviceCredential | undefined,
	now: Date,
	intervalSeconds: number,
): FullLoginReason | undefined {
	if (credential === undefined || credential.lastFullLoginAt === null) {
		return FULL_LOGIN_REASON.NEVER_SIGNED_IN
	}
	if (credential.blockedAt !== null) {
		return FULL_LOGIN_REASON.BLOCKED
	}
	if (secondsAfter(credential.lastFullLoginAt, intervalSeconds).getTime() <= now.getTime()) {
		return FULL_LOGIN_REASON.INTERVAL_EXPIRED
	}
	return undefined
}

export function requiresPinSetup(credential: UserDeviceCredential | undefined): boolean {
	return credential === undefined || credential.pinPublicKey === null || credential.blockedAt !== null
}
