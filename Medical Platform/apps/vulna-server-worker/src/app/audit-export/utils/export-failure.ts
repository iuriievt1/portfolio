import { AUDIT_EXPORT_FAILURE, type AuditExportFailure } from "@ansora/contracts"
import { SyslogMessageTooLargeError, SyslogTimeoutError } from "@ansora/vulna-adapter-syslog"

const UNREACHABLE_CODES: ReadonlySet<string> = new Set([
	"ECONNREFUSED",
	"ECONNRESET",
	"ECONNABORTED",
	"EHOSTUNREACH",
	"ENETUNREACH",
	"ENOTFOUND",
	"EAI_AGAIN",
	"EPIPE",
])

const TIMEOUT_CODE = "ETIMEDOUT"

const TLS_CODES: ReadonlySet<string> = new Set([
	"CERT_HAS_EXPIRED",
	"CERT_NOT_YET_VALID",
	"DEPTH_ZERO_SELF_SIGNED_CERT",
	"SELF_SIGNED_CERT_IN_CHAIN",
	"UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
	"UNABLE_TO_VERIFY_LEAF_SIGNATURE",
])

const TLS_CODE_PREFIXES = ["ERR_TLS_", "ERR_SSL_"] as const

function codeOf(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return undefined
	}
	return typeof error.code === "string" ? error.code : undefined
}

// CAP-025-S03
export function exportFailureOf(error: unknown): AuditExportFailure {
	if (error instanceof SyslogMessageTooLargeError) {
		return AUDIT_EXPORT_FAILURE.MESSAGE_TOO_LARGE
	}
	if (error instanceof SyslogTimeoutError) {
		return AUDIT_EXPORT_FAILURE.TIMED_OUT
	}
	const code = codeOf(error)
	if (code === undefined) {
		return AUDIT_EXPORT_FAILURE.FAILED
	}
	if (UNREACHABLE_CODES.has(code)) {
		return AUDIT_EXPORT_FAILURE.UNREACHABLE
	}
	if (code === TIMEOUT_CODE) {
		return AUDIT_EXPORT_FAILURE.TIMED_OUT
	}
	if (TLS_CODES.has(code) || TLS_CODE_PREFIXES.some((prefix) => code.startsWith(prefix))) {
		return AUDIT_EXPORT_FAILURE.TLS_REJECTED
	}
	return AUDIT_EXPORT_FAILURE.FAILED
}
