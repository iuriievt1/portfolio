// ADR-012
export const API_VERSION = "v1" as const

export const API_BASE_PATH = `/api/${API_VERSION}` as const

export const ADMIN_API_BASE_PATH = `/api/admin/${API_VERSION}` as const

// Dockerfile SERVER_VERSION
export const UNVERSIONED_RELEASE = "unversioned" as const

export const APP_VERSION_HEADER = "X-Vulna-App-Version" as const

export const ACCEPT_LANGUAGE_HEADER = "Accept-Language" as const

export const CONTENT_LANGUAGE_HEADER = "Content-Language" as const

export const AUTHORIZATION_HEADER = "Authorization" as const

export const CONTENT_TYPE_HEADER = "Content-Type" as const

export const BEARER_PREFIX = "Bearer " as const

export const DPOP_HEADER = "DPoP" as const

// CAP-021-R08, CAP-021-R29
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key" as const

// CAP-021-R32, index.yaml AcquisitionVersion
export const ACQUISITION_VERSION_HEADER = "If-Match" as const

// CAP-021-R29, index.yaml RequestKey
export const REQUEST_KEY_HEADER = "X-Vulna-Request-Key" as const

// CAP-002-R09, index.yaml OperatorId
export const OPERATOR_ID_HEADER = "X-Vulna-Operator-Id" as const

// CAP-020-R22
export const IMAGE_RENDITION_HEADER = "X-Vulna-Image-Rendition" as const

// CAP-004-R11, CAP-028-R14, administration.yaml BackgroundRefresh, CHG-190
export const BACKGROUND_REFRESH_HEADER = "X-Vulna-Background-Refresh" as const
export const BACKGROUND_REFRESH = "true" as const

export const DPOP_NONCE_HEADER = "DPoP-Nonce" as const

export const WWW_AUTHENTICATE_HEADER = "WWW-Authenticate" as const

// RFC 9449
export const USE_DPOP_NONCE_ERROR = "use_dpop_nonce" as const

export const RETRY_AFTER_HEADER = "Retry-After" as const

export const SIGNED_BODY_CONTENT_TYPE = "application/jose" as const

export const ADMINISTRATION_SESSION_COOKIE = "vulna_admin_session" as const

export const LOGIN_RETURN_URL = "ansoravulna://login/oidc" as const

export const LOGIN_RETURN_PARAMETER = {
	STATE: "state",
	COMPLETION_CODE: "completion_code",
} as const
