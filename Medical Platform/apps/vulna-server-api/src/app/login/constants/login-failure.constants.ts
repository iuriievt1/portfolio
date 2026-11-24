export const LOGIN_FAILURE_DETAIL = {
	UNKNOWN_PERSONAL_NUMBER: "unknown-personal-number",
	DELAY_NOT_ELAPSED: "delay-not-elapsed",
	PIN_NOT_SET: "pin-not-set",
	CHALLENGE: "challenge",
	UNKNOWN_CARRIER: "unknown-carrier",
	INACTIVE: "inactive",
	PROVIDER: "provider",
	OUTSIDE_AUTHORIZED_GROUP: "outside-authorized-group",
} as const

// CAP-001-R02, CAP-003-R04
export const OUTSIDE_AUTHORIZED_GROUP = "outside_authorized_group"

export const SIGNED_BODY_DETAIL_PREFIX = "body-"
