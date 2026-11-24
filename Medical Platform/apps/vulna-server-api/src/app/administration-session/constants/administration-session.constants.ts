export const ADMINISTRATION_SESSION_END_REASON = {
	LOGOUT: "logout",
	IDLE: "idle",
	EXPIRED: "expired",
	ACCESS_REVOKED: "access_revoked",
	PROVIDER_REJECTED: "provider_rejected",
} as const

export type AdministrationSessionEndReason =
	(typeof ADMINISTRATION_SESSION_END_REASON)[keyof typeof ADMINISTRATION_SESSION_END_REASON]

export const KEEPS_IDLE_TIME = "administration:keeps-idle-time"

export const REQUIRED_PERMISSION = "administration:required-permission"
