import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it, vi } from "vitest"
import { ApiProblemError } from "../../../api/api-error"
import { REMOTE_FAILURE } from "../../../api/remote-failure"
import { CAPTURE_FAILURE, captureFailureOf, remoteCaptureFailureOf } from "../capture-failure"

vi.mock("@ansora/core-mobile", () => ({
	NATIVE_ERROR_CODE: { STORAGE_FULL: "storage-full", PHOTO_UNREADABLE: "photo-unreadable" },
}))

const HTTP_CONFLICT = 409
const HTTP_SERVER_ERROR = 500
const HTTP_UNAVAILABLE = 503

function nativeError(code: string): Error {
	return Object.assign(new Error("the native module failed"), { code })
}

describe("capture failure", () => {
	it("CAP-015-S03 E17 says the device has no room for the photo", () => {
		expect(captureFailureOf(nativeError("storage-full"))).toBe(CAPTURE_FAILURE.STORAGE_FULL)
	})

	it("CAP-015-S06 E18 says the photo could not be prepared", () => {
		expect(captureFailureOf(nativeError("photo-unreadable"))).toBe(CAPTURE_FAILURE.UNREADABLE)
	})

	it("E18 never blames the connection for a failure on the device", () => {
		expect(captureFailureOf(new TypeError("undefined is not a function"))).toBe(CAPTURE_FAILURE.UNREADABLE)
	})

	it("CAP-002-R17 E70 says the server could not be reached", () => {
		expect(remoteCaptureFailureOf(new TypeError("Network request failed"))).toBe(REMOTE_FAILURE.NO_CONNECTION)
		expect(remoteCaptureFailureOf(new ApiProblemError(HTTP_SERVER_ERROR, undefined))).toBe(REMOTE_FAILURE.SERVER_ERROR)
	})

	it("CAP-021-R32 E115 says the record changed in the meantime", () => {
		expect(remoteCaptureFailureOf(new ApiProblemError(HTTP_CONFLICT, ERROR_CODE.ACQUISITION_VERSION_CONFLICT))).toBe(
			CAPTURE_FAILURE.CHANGED,
		)
	})

	it("ADR-054 E129 says the documentation is unavailable", () => {
		expect(remoteCaptureFailureOf(new ApiProblemError(HTTP_UNAVAILABLE, ERROR_CODE.DOCUMENTATION_UNAVAILABLE))).toBe(
			REMOTE_FAILURE.DOCUMENTATION_UNAVAILABLE,
		)
	})
})
