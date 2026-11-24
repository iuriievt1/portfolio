import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it, vi } from "vitest"
import { CodedError } from "../../../../../../libs/core/mobile/src/__tests__/coded-error"
import { ApiProblemError } from "../../../api/api-error"
import {
	failureOutcomeOf,
	isStorageKeyLost,
	isUnreadableFile,
	replacementOutcomeOf,
	retryDelayOf,
	uploadOutcomeOf,
} from "../upload-outcome"

vi.mock("@ansora/core-mobile", async () => ({
	...(await import("../../../../../../libs/core/mobile/src/storage/upload-status")),
	...(await import("../../../../../../libs/core/mobile/src/native/upload-stage")),
	...(await import("../../../../../../libs/core/mobile/src/native/error-codes")),
	...(await import("../../../../../../libs/core/mobile/src/storage/encrypted-file-store")),
}))

const NETWORK = "network" as const
const CERTIFICATE = "certificate" as const
const RETRY_AFTER_SECONDS = 120
const RETRY = { kind: "retry", retryAfterMs: undefined }

const UPLOAD = "upload" as const
const ANNOUNCEMENT = "announcement" as const

function answered(status: number, code?: string) {
	return { stage: UPLOAD, status, body: code === undefined ? null : JSON.stringify({ code }), failure: null }
}

function receipt(status: string) {
	return { stage: ANNOUNCEMENT, status: 201, body: JSON.stringify({ file: { status } }), failure: null }
}

describe("uploadOutcomeOf", () => {
	it("CAP-019-R24 takes a created or repeated upload as received", () => {
		expect(uploadOutcomeOf(answered(201))).toEqual({ kind: "received" })
		expect(uploadOutcomeOf(answered(200))).toEqual({ kind: "received" })
	})

	it("NAB-206 CAP-019-S01 CAP-019-R13 sends again after a broken connection or a busy server", () => {
		expect(uploadOutcomeOf({ stage: UPLOAD, status: null, body: null, failure: NETWORK })).toEqual(RETRY)
		expect(uploadOutcomeOf({ stage: UPLOAD, status: null, body: null, failure: CERTIFICATE })).toEqual(RETRY)
		expect(uploadOutcomeOf(answered(503, ERROR_CODE.DOCUMENTATION_UNAVAILABLE))).toEqual(RETRY)
		expect(uploadOutcomeOf(answered(503))).toEqual(RETRY)
		expect(uploadOutcomeOf(answered(429))).toEqual(RETRY)
		expect(uploadOutcomeOf(answered(408))).toEqual(RETRY)
		expect(uploadOutcomeOf(answered(401, ERROR_CODE.SIGN_IN_AGAIN))).toEqual(RETRY)
	})

	it("CAP-012-R24 CAP-006-R21 keeps waiting files of an old app or an unknown device", () => {
		expect(uploadOutcomeOf(answered(426, ERROR_CODE.APP_VERSION_UNSUPPORTED))).toEqual(RETRY)
		expect(uploadOutcomeOf(answered(403, ERROR_CODE.DEVICE_UNKNOWN))).toEqual(RETRY)
		expect(uploadOutcomeOf(answered(403, ERROR_CODE.DEVICE_PENDING_APPROVAL))).toEqual(RETRY)
	})

	it("CAP-019-R14 CAP-015-R36 does not send again what the server refused for good", () => {
		for (const code of [
			ERROR_CODE.RECORD_REJECTED,
			ERROR_CODE.ACQUISITION_ALREADY_DECIDED,
			ERROR_CODE.RESOURCE_NOT_FOUND,
			ERROR_CODE.IDEMPOTENCY_CONFLICT,
		]) {
			expect(uploadOutcomeOf(answered(422, code))).toEqual({ kind: "rejected", code })
		}
	})

	it("CAP-019-S18 E113 keeps the code that tells a decided record apart from a refused file", () => {
		expect(uploadOutcomeOf(answered(409, ERROR_CODE.ACQUISITION_ALREADY_DECIDED))).toEqual({
			kind: "rejected",
			code: ERROR_CODE.ACQUISITION_ALREADY_DECIDED,
		})
	})

	it("CAP-019-R27 E27 judges a code it does not know by the class of the answer", () => {
		expect(uploadOutcomeOf({ stage: UPLOAD, status: 404, body: "not json", failure: null })).toEqual({
			kind: "rejected",
			code: null,
		})
		expect(uploadOutcomeOf(answered(418, "a-code-of-a-later-release"))).toEqual({
			kind: "rejected",
			code: "a-code-of-a-later-release",
		})
		expect(uploadOutcomeOf(answered(502, "a-code-of-a-later-release"))).toEqual(RETRY)
	})

	it("NAB-503 CAP-007-R11 CAP-019-R14 does not mark a file failed on a revoked device", () => {
		expect(uploadOutcomeOf(answered(403, ERROR_CODE.DEVICE_REVOKED))).toEqual({ kind: "revoked" })
	})

	it("ADR-014 CAP-015-R35 CAP-015-R36 takes over the receipt of an announcement the system made", () => {
		expect(uploadOutcomeOf(receipt("received"))).toEqual({ kind: "received" })
		expect(uploadOutcomeOf(receipt("rejected"))).toEqual({ kind: "rejected", code: null })
		expect(uploadOutcomeOf(receipt("announced"))).toEqual(RETRY)
	})

	it("ADR-014 CAP-019-R14 judges a refused announcement like a refused upload", () => {
		const refused = { ...answered(403, ERROR_CODE.DEVICE_REVOKED), stage: ANNOUNCEMENT }

		expect(uploadOutcomeOf(refused)).toEqual({ kind: "revoked" })
	})

	it("CAP-014-R07 takes an upload to a closed record as late, not as refused", () => {
		expect(uploadOutcomeOf(answered(409, ERROR_CODE.ACQUISITION_CLOSED))).toEqual({ kind: "late" })
	})
})

describe("failureOutcomeOf", () => {
	it("NAB-209 CAP-002-R17 treats a request that never reached the server as passing", () => {
		expect(failureOutcomeOf(new TypeError("Network request failed"))).toEqual(RETRY)
	})

	it("CAP-019-R14 keeps the stable code of a permanent refusal", () => {
		expect(failureOutcomeOf(new ApiProblemError(409, ERROR_CODE.ACQUISITION_ALREADY_DECIDED))).toEqual({
			kind: "rejected",
			code: ERROR_CODE.ACQUISITION_ALREADY_DECIDED,
		})
	})

	it("CAP-019-R18 waits as long as the server asks", () => {
		expect(failureOutcomeOf(new ApiProblemError(429, undefined, RETRY_AFTER_SECONDS))).toEqual({
			kind: "retry",
			retryAfterMs: RETRY_AFTER_SECONDS * 1000,
		})
	})
})

describe("replacementOutcomeOf", () => {
	it("CAP-015-R34 E115 keeps the received file when the server refuses its edit", () => {
		expect(replacementOutcomeOf(new ApiProblemError(409, ERROR_CODE.ACQUISITION_VERSION_CONFLICT))).toEqual({
			kind: "edit_refused",
			code: ERROR_CODE.ACQUISITION_VERSION_CONFLICT,
		})
		expect(replacementOutcomeOf(new ApiProblemError(422, ERROR_CODE.RECORD_REJECTED))).toEqual({
			kind: "edit_refused",
			code: ERROR_CODE.RECORD_REJECTED,
		})
		expect(replacementOutcomeOf(new ApiProblemError(409, ERROR_CODE.ACQUISITION_CLOSED))).toEqual({
			kind: "edit_refused",
			code: ERROR_CODE.ACQUISITION_CLOSED,
		})
	})

	it("CAP-019-R13 sends the edit again after a passing failure", () => {
		expect(replacementOutcomeOf(new TypeError("Network request failed"))).toEqual(RETRY)
		expect(replacementOutcomeOf(new ApiProblemError(403, ERROR_CODE.DEVICE_REVOKED))).toEqual({ kind: "revoked" })
	})
})

describe("retryDelayOf", () => {
	it("CAP-019-R18 waits longer after every failed attempt and slows down after a few", () => {
		const delays = [0, 1, 2, 3, 4, 10].map((attempt) => retryDelayOf(attempt, undefined))
		expect(delays).toEqual([...delays].sort((first, second) => first - second))
		expect(retryDelayOf(10, undefined)).toBe(retryDelayOf(4, undefined))
	})

	it("RFC 9110 CAP-019-R18 never comes back before the server asked", () => {
		expect(retryDelayOf(0, 90_000)).toBe(90_000)
		expect(retryDelayOf(10, 1000)).toBe(retryDelayOf(10, undefined))
	})
})

describe("isUnreadableFile", () => {
	it("CAP-009-S05 Q-076 tells a file the device cannot read from a passing failure", () => {
		expect(isUnreadableFile(new CodedError("file-key-invalid"))).toBe(true)
		expect(isUnreadableFile(new CodedError("file-unavailable"))).toBe(true)
		expect(isUnreadableFile(new CodedError("stored-file-not-found"))).toBe(true)
		expect(isUnreadableFile(new CodedError("key-invalidated"))).toBe(false)
		expect(isUnreadableFile(new CodedError("device-locked"))).toBe(false)
		expect(isUnreadableFile(new ApiProblemError(422, ERROR_CODE.RECORD_REJECTED))).toBe(false)
	})
})

describe("isStorageKeyLost", () => {
	it("CAP-009-S05 Q-076 tells a queue its key no longer opens from a file it cannot read", () => {
		expect(isStorageKeyLost(new CodedError("key-invalidated"))).toBe(true)
		expect(isStorageKeyLost(new CodedError("file-key-invalid"))).toBe(false)
		expect(isStorageKeyLost(new CodedError("device-locked"))).toBe(false)
	})
})
