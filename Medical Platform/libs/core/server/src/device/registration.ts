import { optionalText } from "../text"
import { isFresh } from "./device-proof"
import { JWS_ALGORITHM, parseCompactJws, verifyJwsSignature } from "./jws"
import type { PublicKeyJwk } from "./public-key"

export const DEVICE_STATE = {
	PENDING_APPROVAL: "pending_approval",
	APPROVED: "approved",
	REVOKED: "revoked",
	BLOCKED: "blocked",
} as const

export type DeviceState = (typeof DEVICE_STATE)[keyof typeof DEVICE_STATE]

export const DEVICE_PLATFORM = {
	IOS: "ios",
	ANDROID: "android",
} as const

export type DevicePlatform = (typeof DEVICE_PLATFORM)[keyof typeof DEVICE_PLATFORM]

export const SECURE_HARDWARE = {
	SECURE_ENCLAVE: "secure_enclave",
	STRONGBOX: "strongbox",
	KEYSTORE: "keystore",
	UNKNOWN: "unknown",
} as const

export type SecureHardware = (typeof SECURE_HARDWARE)[keyof typeof SECURE_HARDWARE]

export const REGISTRATION_REJECTION = {
	MALFORMED: "malformed",
	SIGNATURE_INVALID: "signature-invalid",
	KEY_MISMATCH: "key-mismatch",
	STALE: "stale",
} as const

export type RegistrationRejection = (typeof REGISTRATION_REJECTION)[keyof typeof REGISTRATION_REJECTION]

export interface RegistrationClaims {
	model: string
	osVersion: string
	platform: DevicePlatform
	secureHardware: SecureHardware
	managedConfiguration: boolean
	registrationSecret: string | undefined
	groupCode: string | undefined
	blockedPredecessorHwId: string | undefined
	issuedAt: number
}

export interface AcceptedRegistration {
	ok: true
	claims: RegistrationClaims
}

export interface RejectedRegistration {
	ok: false
	reason: RegistrationRejection
}

export type RegistrationVerdict = AcceptedRegistration | RejectedRegistration

export function verifyRegistrationBody(jws: string, proofKey: PublicKeyJwk, now: Date): RegistrationVerdict {
	const parsed = parseCompactJws(jws)
	if (parsed === undefined || parsed.header.alg !== JWS_ALGORITHM) {
		return { ok: false, reason: REGISTRATION_REJECTION.MALFORMED }
	}
	if (!verifyJwsSignature(parsed, proofKey)) {
		return { ok: false, reason: REGISTRATION_REJECTION.KEY_MISMATCH }
	}
	const claims = registrationClaims(parsed.payload)
	if (claims === undefined) {
		return { ok: false, reason: REGISTRATION_REJECTION.MALFORMED }
	}
	if (!isFresh(claims.issuedAt, now)) {
		return { ok: false, reason: REGISTRATION_REJECTION.STALE }
	}
	return { ok: true, claims }
}

export function registrationState(claims: RegistrationClaims, expectedSecret: string | undefined): DeviceState {
	if (claims.blockedPredecessorHwId !== undefined) {
		return DEVICE_STATE.PENDING_APPROVAL
	}
	return hasRegistrationSecret(claims, expectedSecret) ? DEVICE_STATE.APPROVED : DEVICE_STATE.PENDING_APPROVAL
}

export function registrationGroupCode(claims: RegistrationClaims, expectedSecret: string | undefined): string | null {
	if (claims.groupCode === undefined || !hasRegistrationSecret(claims, expectedSecret)) {
		return null
	}
	return claims.groupCode
}

function hasRegistrationSecret(claims: RegistrationClaims, expectedSecret: string | undefined): boolean {
	return expectedSecret !== undefined && expectedSecret.length > 0 && claims.registrationSecret === expectedSecret
}

function registrationClaims(payload: Record<string, unknown>): RegistrationClaims | undefined {
	const { model, os_version, platform, secure_hardware, managed_configuration, iat } = payload
	if (
		typeof model !== "string" ||
		typeof os_version !== "string" ||
		!isPlatform(platform) ||
		!isSecureHardware(secure_hardware) ||
		typeof managed_configuration !== "boolean" ||
		typeof iat !== "number"
	) {
		return undefined
	}
	return {
		model,
		osVersion: os_version,
		platform,
		secureHardware: secure_hardware,
		managedConfiguration: managed_configuration,
		registrationSecret: optionalText(payload.registration_secret),
		groupCode: optionalText(payload.group_code),
		blockedPredecessorHwId: optionalText(payload.blocked_predecessor_hw_id),
		issuedAt: iat,
	}
}

function isPlatform(value: unknown): value is DevicePlatform {
	return value === DEVICE_PLATFORM.IOS || value === DEVICE_PLATFORM.ANDROID
}

function isSecureHardware(value: unknown): value is SecureHardware {
	return Object.values(SECURE_HARDWARE).includes(value as SecureHardware)
}
