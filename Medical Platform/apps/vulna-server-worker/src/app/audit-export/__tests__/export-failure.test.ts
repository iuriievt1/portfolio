import { SyslogMessageTooLargeError, SyslogTimeoutError } from "@ansora/vulna-adapter-syslog"
import { describe, expect, it } from "vitest"
import { exportFailureOf } from "../utils/export-failure"

function withCode(code: string): Error {
	return Object.assign(new Error(code), { code })
}

describe("exportFailureOf", () => {
	it("names why the log management system did not take the records", () => {
		expect(exportFailureOf(withCode("ECONNREFUSED"))).toBe("unreachable")
		expect(exportFailureOf(withCode("ENOTFOUND"))).toBe("unreachable")
		expect(exportFailureOf(withCode("ETIMEDOUT"))).toBe("timed_out")
		expect(exportFailureOf(new SyslogTimeoutError())).toBe("timed_out")
		expect(exportFailureOf(withCode("DEPTH_ZERO_SELF_SIGNED_CERT"))).toBe("tls_rejected")
		expect(exportFailureOf(withCode("ERR_TLS_CERT_ALTNAME_INVALID"))).toBe("tls_rejected")
		expect(exportFailureOf(new SyslogMessageTooLargeError(70_000))).toBe("message_too_large")
	})

	it("falls back to a general failure for anything else", () => {
		expect(exportFailureOf(new Error("boom"))).toBe("failed")
		expect(exportFailureOf("boom")).toBe("failed")
		expect(exportFailureOf(withCode("EACCES"))).toBe("failed")
	})
})
