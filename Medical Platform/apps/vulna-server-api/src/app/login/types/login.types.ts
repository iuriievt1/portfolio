import type { AdministrationContract, ErrorCode, MobileContract } from "@ansora/contracts"
import type {
	AuditOutcome,
	AuthenticatedIdentity,
	IdentityProviderFailure,
	JsonObject,
	LoginMethod,
	PinPublicKeyJwk,
	Role,
	RoleOrigin,
	SessionOutcome,
} from "@ansora/core-server"
import type { Request } from "express"
import type { Device } from "../../device/types/device.types"
import type { OUTSIDE_AUTHORIZED_GROUP } from "../constants/login-failure.constants"

type Schemas = MobileContract.components["schemas"]

export type OidcStartInput = Schemas["OidcStartRequest"]
export type OidcStartResponse = Schemas["OidcStartResponse"]
export type OidcCallbackInput = Schemas["OidcCallbackRequest"]
export type ChallengeResponse = Schemas["Challenge"]
export type PinLoginInput = Schemas["PinLoginRequest"]
export type SessionRefreshInput = Schemas["SessionRefreshRequest"]
export type SessionResponse = Schemas["Session"]
export type CardBindingReceipt = Schemas["CardBindingReceipt"]

export interface AppUserRow {
	id: string
	personal_number: string | null
	login_name: string | null
	email: string | null
	display_name: string
	is_active: boolean
	preferred_language: string | null
}

export interface AppUser {
	id: string
	personalNumber: string | null
	loginName: string | null
	email: string | null
	displayName: string
	isActive: boolean
	preferredLanguage: string | null
}

// administration.yaml User login_name, email
export interface DirectoryAccount {
	loginName: string | null
	email: string | null
}

export interface IdpIdentityRow {
	id: string
	user_id: string
	refresh_token: string | null
	groups: string[]
}

export interface IdpIdentity {
	id: string
	userId: string
	refreshToken: string | null
	groups: string[]
}

export interface UserRoleRow {
	role: Role
	origin: RoleOrigin
}

export interface RolePermissionRow {
	permission: string
}

export type LoginFlowOutcome = { ok: true; identity: AuthenticatedIdentity } | { ok: false; code: ErrorCode }

export interface LoginFlowRow {
	state: string
	device_id: string
	device_key_thumbprint: string
	code_verifier: string
	nonce: string
	expected_personal_number: string | null
	started_at: Date
	expires_at: Date
	returned_at: Date | null
	outcome: LoginFlowOutcome | null
	completion_code_hash: string | null
	completion_expires_at: Date | null
	consumed_at: Date | null
}

export interface NewLoginFlow {
	state: string
	deviceId: string
	deviceKeyThumbprint: string
	codeVerifier: string
	nonce: string
	expectedPersonalNumber: string | null
	startedAt: Date
	expiresAt: Date
}

export interface LoginFlowReturn {
	returnedAt: Date
	outcome: LoginFlowOutcome
	completionCodeHash: string
	completionExpiresAt: Date
}

export interface LoginChallengeRow {
	value_hash: string
	confirmed_user_id: string | null
}

export interface ConsumedChallenge {
	confirmedUserId: string | null
}

export interface UserDeviceCredentialRow {
	pin_public_key: PinPublicKeyJwk | null
	blocked_at: Date | null
	last_full_login_at: Date | null
}

export interface LoginAttempt {
	deviceId: string
	userId: string | null
	method: LoginMethod
	outcome: AuditOutcome
	reason: string | null
	sessionId: string | null
}

export interface FailureState {
	consecutiveFailures: number
	lastFailedAt: Date | undefined
}

export interface CardRow {
	id: string
	user_id: string
	short_uid: string
	bound_at: Date
}

export interface CardBindingCodeRow {
	code_hash: string
	user_id: string
	expires_at: Date
	consumed_at: Date | null
}

export interface QrCodeRow {
	id: string
	user_id: string
}

export interface UserSessionRow {
	id: string
	user_id: string
	device_id: string
	expires_at: Date
	created_at: Date
	session_end: Date
	ended_at: Date | null
}

export interface UserSession {
	id: string
	userId: string
	deviceId: string
	tokenExpiresAt: Date
	startedAt: Date
	sessionEnd: Date
	endedAt: Date | null
}

export interface IssuedSession {
	session: UserSession
	token: string
	outcome: SessionOutcome
}

export interface CurrentSession {
	session: UserSession
	token: string
	device: Device
}

export type UserSessionRequest = Request & { userSession?: CurrentSession }

export type CardBindingCode = AdministrationContract.components["schemas"]["CardBindingCode"]

export interface AttemptRecord {
	deviceId: string
	userId: string | null
	method: LoginMethod
	sessionId: string | null
	reason: ErrorCode | undefined
	details: JsonObject
}

export interface ProviderReturn {
	state: string
	code: string | undefined
	error: string | undefined
	errorDescription: string | undefined
}

export type ProviderConfirmation =
	| { ok: true }
	| { ok: false; failure: IdentityProviderFailure | typeof OUTSIDE_AUTHORIZED_GROUP }

export interface NewCard {
	userId: string
	identifierHash: string
	shortUid: string
	boundByDeviceId: string
	boundAt: Date
}

export interface NewCardBindingCode {
	codeHash: string
	userId: string
	issuedByUserId: string | null
	issuedAt: Date
	expiresAt: Date
}

export interface NewUserSession {
	userId: string
	deviceId: string
	tokenHash: string
	tokenExpiresAt: Date
	startedAt: Date
	sessionEnd: Date
}
