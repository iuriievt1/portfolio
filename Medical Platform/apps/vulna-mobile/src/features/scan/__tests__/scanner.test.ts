import { describe, expect, it, vi } from "vitest"
import { isAtLimit } from "../../capture/shot-limit"
import { SCAN_FAILURE, scanFailureOf } from "../scan-failure"

vi.mock("@ansora/core-mobile", () => ({
	NATIVE_ERROR_CODE: { STORAGE_FULL: "storage-full", SCANNER_NOT_READY: "scanner-not-ready" },
}))

const PAGE_LIMIT = 30

function nativeError(code: string): Error {
	return Object.assign(new Error("the document scanner failed"), { code })
}

describe("document scanner", () => {
	it("CAP-015-S03 E17 says the device has no room for the page", () => {
		expect(scanFailureOf(nativeError("storage-full"))).toBe(SCAN_FAILURE.STORAGE_FULL)
	})

	it("E18 says the page could not be prepared", () => {
		expect(scanFailureOf(nativeError("page-unreadable"))).toBe(SCAN_FAILURE.UNREADABLE)
		expect(scanFailureOf(new Error("the document scanner is not available"))).toBe(SCAN_FAILURE.UNREADABLE)
	})

	it("CAP-018-R02 stays quiet while the scanner is still starting", () => {
		expect(scanFailureOf(nativeError("scanner-not-ready"))).toBeUndefined()
	})

	it("CAP-018-R12 E22 stops at the page limit of the instance", () => {
		expect(isAtLimit(PAGE_LIMIT - 1, PAGE_LIMIT)).toBe(false)
		expect(isAtLimit(PAGE_LIMIT, PAGE_LIMIT)).toBe(true)
	})

	it("CAP-018-S12 adds no page to a document that already has more than a lowered limit", () => {
		expect(isAtLimit(PAGE_LIMIT + 1, PAGE_LIMIT)).toBe(true)
	})

	it("CAP-018-R12 sets no limit until the configuration is known", () => {
		expect(isAtLimit(PAGE_LIMIT, undefined)).toBe(false)
	})
})
