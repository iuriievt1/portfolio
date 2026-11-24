import type { components } from "./generated/administration"
import type { components as mobileComponents } from "./generated/mobile"

export type AdministrationErrorCode = components["schemas"]["AdministrationErrorCode"]
export type MobileErrorCode = mobileComponents["schemas"]["ErrorCode"]

// ADR-012, ADR-037, RFC 9457
export const ERROR_CODE = {
	// NAB-207, NAB-209
	RETRY: "retry",
	// NAB-223, NAB-278
	SIGN_IN_AGAIN: "reauthentication-required",
	// NAB-504
	DEVICE_REVOKED: "device-revoked",
	// CAP-006-R21
	DEVICE_UNKNOWN: "device-unknown",
	// NAB-519
	DEVICE_PENDING_APPROVAL: "device-pending-approval",
	// NAB-455, NAB-457
	DEVICE_BLOCKED: "device-blocked",
	APP_VERSION_UNSUPPORTED: "app-version-unsupported",
	// ADR-012
	RECORD_REJECTED: "record-rejected",
	LOGIN_FAILED: "login-failed",
	ATTEMPTS_EXHAUSTED: "attempts-exhausted",
	METHOD_DISABLED: "method-disabled",
	CHALLENGE_INVALID: "challenge-invalid",
	ACCOUNT_INACTIVE: "account-inactive",
	PROVIDER_UNAVAILABLE: "provider-unavailable",
	LOGIN_INCOMPLETE: "login-incomplete",
	LOGIN_DEVICE_MISMATCH: "login-device-mismatch",
	COMPLETION_CODE_INVALID: "completion-code-invalid",
	LOGIN_IDENTITY_MISMATCH: "login-identity-mismatch",
	LOGIN_AUTHENTICATION_STALE: "login-authentication-stale",
	LOGIN_PERSONAL_NUMBER_MISSING: "login-personal-number-missing",
	PIN_SETUP_REQUIRED: "pin-setup-required",
	FULL_LOGIN_REQUIRED: "full-login-required",
	CARD_BINDING_CODE_INVALID: "card-binding-code-invalid",
	CARD_BINDING_DISABLED: "card-binding-disabled",
	CARD_ALREADY_BOUND: "card-already-bound",
	LANGUAGE_UNSUPPORTED: "language-unsupported",
	RESOURCE_NOT_FOUND: "resource-not-found",
	// CAP-013-R17
	SEARCH_QUERY_TOO_SHORT: "search-query-too-short",
	SEARCH_TOO_BROAD: "search-too-broad",
	SEARCH_RATE_LIMITED: "search-rate-limited",
	// CAP-014-R20, CAP-014-R29
	ENCOUNTER_HAS_DRAFT: "encounter-has-draft",
	ENCOUNTER_WITHOUT_CLOSED_RECORD: "encounter-without-closed-record",
	ENCOUNTER_CANCELLED: "encounter-cancelled",
	// CAP-014-R21, CAP-014-R30
	ENCOUNTER_COMPLETED: "encounter-completed",
	ENCOUNTER_NOT_TODAY: "encounter-not-today",
	// Q-150
	ENCOUNTER_HAS_CLOSED_RECORD: "encounter-has-closed-record",
	// CAP-014-R07, CAP-021-R29
	ACQUISITION_CLOSED: "acquisition-closed",
	// CAP-021-R32
	ACQUISITION_VERSION_CONFLICT: "acquisition-version-conflict",
	// CAP-014-R06, CAP-021-R29
	IDEMPOTENCY_CONFLICT: "idempotency-conflict",
	// CAP-021-R13
	OPERATOR_UNVERIFIED: "operator-unverified",
	// CAP-015-R18
	DRAFT_LIMIT_REACHED: "draft-limit-reached",
	// CAP-014-R26
	PATIENT_MISMATCH: "patient-mismatch",
	// ADR-054
	DOCUMENTATION_UNAVAILABLE: "documentation-unavailable",
	// CAP-017-R02, CAP-025-R30
	WOUND_TYPE_LOCKED: "wound-type-locked",
	// CAP-021-R25, CAP-015-R36
	ACQUISITION_INCOMPLETE: "acquisition-incomplete",
	// CAP-019-R14
	ACQUISITION_ALREADY_DECIDED: "acquisition-already-decided",
	// CAP-015-R37
	ACQUISITION_HAS_FILES: "acquisition-has-files",
	// CAP-017-R02
	FINDING_WOUND_TYPE_CONFLICT: "finding-wound-type-conflict",
	// CAP-020-R22
	IMAGE_SOURCE_UNAVAILABLE: "image-source-unavailable",
} as const satisfies Record<string, MobileErrorCode>

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE]

// ADR-012, api/README.md 5
export const PERMANENT_REJECTIONS: readonly ErrorCode[] = [
	ERROR_CODE.DEVICE_REVOKED,
	ERROR_CODE.RECORD_REJECTED,
	ERROR_CODE.RESOURCE_NOT_FOUND,
	ERROR_CODE.IDEMPOTENCY_CONFLICT,
	ERROR_CODE.PATIENT_MISMATCH,
	ERROR_CODE.ACQUISITION_ALREADY_DECIDED,
	ERROR_CODE.OPERATOR_UNVERIFIED,
]

export function isPermanentRejection(code: ErrorCode): boolean {
	return PERMANENT_REJECTIONS.includes(code)
}

export const ADMINISTRATION_ERROR_CODE = {
	RETRY: "retry",
	REAUTHENTICATION_REQUIRED: "reauthentication-required",
	PERMISSION_DENIED: "permission-denied",
	VERSION_CONFLICT: "version-conflict",
	VALUE_OUT_OF_RANGE: "value-out-of-range",
	DEFAULT_LANGUAGE_NOT_SUPPORTED: "default-language-not-supported",
	// CAP-012-R28, CAP-012-S19
	DEFAULT_LANGUAGE_NAMES_MISSING: "default-language-names-missing",
	// CAP-017-R18, CAP-017-S08
	CODE_LIST_ITEM_NAME_MISSING: "code-list-item-name-missing",
	// CAP-017-R18, CAP-017-S09
	CODE_LIST_ITEM_UNKNOWN: "code-list-item-unknown",
	DEVICE_NOT_PENDING: "device-not-pending",
	// CAP-007-S07
	DEVICE_NOT_BLOCKED: "device-not-blocked",
	FINGERPRINT_MISMATCH: "fingerprint-mismatch",
	NOT_FOUND: "not-found",
	RECORD_REJECTED: "record-rejected",
	CARD_BINDING_NOT_APPLICABLE: "card-binding-not-applicable",
	DEPARTMENT_FROM_DIRECTORY: "department-from-directory",
	// CAP-021-R27
	CLINICAL_RECORD_WRITE_NOT_FAILED: "clinical-record-write-not-failed",
	// CAP-015-R19, CAP-015-S20
	DRAFT_DISCARD_NOT_ALLOWED: "draft-discard-not-allowed",
	// CAP-023-R23
	TARGET_NOT_PAUSED: "target-not-paused",
	// CAP-023-R26
	VERIFICATION_NOT_ON_HOLD: "verification-not-on-hold",
	// CAP-023-R28
	DELIVERY_NOT_CLOSABLE: "delivery-not-closable",
	// CAP-022-R15
	TEXT_RECOGNITION_NOT_FAILED: "text-recognition-not-failed",
	// CAP-023-R12, CHG-189
	ALERT_NOT_ACKNOWLEDGEABLE: "alert-not-acknowledgeable",
	// CAP-026-R14
	ORPHANED_OBJECT_NOT_SET_ASIDE: "orphaned-object-not-set-aside",
} as const satisfies Record<string, AdministrationErrorCode>

export type ProblemCode = ErrorCode | AdministrationErrorCode

// RFC 9457, ADR-012
export interface ProblemJson {
	type: string
	title: string
	status: number
	detail?: string
	instance?: string
	// ADR-012
	code: ProblemCode
}
