import type { components as AdministrationComponents } from "./generated/administration"
import type { components } from "./generated/mobile"

export type LoginStartReason = NonNullable<components["schemas"]["OidcStartRequest"]["reason"]>

export const LOGIN_START_REASON = {
	FIRST_LOGIN: "first_login",
	INTERVAL_EXPIRED: "interval_expired",
	PIN_ATTEMPTS_EXHAUSTED: "pin_attempts_exhausted",
	UNLOCK: "unlock",
} as const satisfies Record<string, LoginStartReason>

export type LoginMethod = NonNullable<components["schemas"]["EffectiveConfiguration"]["allowed_login_methods"]>[number]

export const LOGIN_METHOD = {
	OIDC: "oidc",
	CARD: "card",
	QR: "qr",
	BARCODE: "barcode",
	PIN: "pin",
} as const satisfies Record<string, LoginMethod>

export type Role = AdministrationComponents["schemas"]["RoleCode"]

export const ROLE = {
	CLINICIAN: "clinician",
	ADMINISTRATOR: "administrator",
} as const satisfies Record<string, Role>

export type UserState = AdministrationComponents["schemas"]["User"]["state"]

// CAP-005-R07
export const USER_STATE = {
	ACTIVE: "active",
	REVOKED: "revoked",
} as const satisfies Record<string, UserState>

export type CarrierState = AdministrationComponents["schemas"]["Card"]["state"]

// CAP-005-R03, CAP-005-R05
export const CARRIER_STATE = {
	VALID: "valid",
	REVOKED: "revoked",
} as const satisfies Record<string, CarrierState>
