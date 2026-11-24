import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { ApiProblemError } from "../../../api/api-error"
import { documentationFailureOf, isRetryable, REMOTE_FAILURE, remoteFailureOf } from "../../../api/remote-failure"
import cs from "../../../i18n/cs.json"
import { remoteFailureTextOf } from "../remote-failure-text"

const SERVER_ERROR_HEADING = cs.visit.finishFailed

describe("text of a failed request", () => {
	it("CAP-002-R17 says that there is no connection", () => {
		expect(remoteFailureTextOf(REMOTE_FAILURE.NO_CONNECTION, SERVER_ERROR_HEADING, cs)).toEqual(cs.remote.noConnection)
	})

	it("E129 says that the documentation is unavailable, not that the server or the connection failed", () => {
		expect(remoteFailureTextOf(REMOTE_FAILURE.DOCUMENTATION_UNAVAILABLE, SERVER_ERROR_HEADING, cs)).toEqual(
			cs.remote.documentationUnavailable,
		)
	})

	it("names the action that failed when the server answers with an error", () => {
		expect(remoteFailureTextOf(REMOTE_FAILURE.SERVER_ERROR, SERVER_ERROR_HEADING, cs)).toEqual({
			heading: SERVER_ERROR_HEADING,
			body: cs.remote.serverError,
		})
	})
})

const NOT_FOUND = 404
const GONE = 410

describe("documentation that the server does not give out", () => {
	it("CAP-020-S03 answers a finding out of scope like a missing one, by E29 without retrying", () => {
		const failure = documentationFailureOf(new ApiProblemError(NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND))
		expect(failure).toBe(REMOTE_FAILURE.NOT_FOUND)
		expect(remoteFailureTextOf(failure, SERVER_ERROR_HEADING, cs)).toEqual(cs.remote.notFound)
		expect(isRetryable(failure)).toBe(false)
	})

	it("CAP-002-R17 keeps every other failure retryable", () => {
		expect(documentationFailureOf(new ApiProblemError(GONE, ERROR_CODE.RESOURCE_NOT_FOUND))).toBe(
			REMOTE_FAILURE.SERVER_ERROR,
		)
		expect(documentationFailureOf(new TypeError("Network request failed"))).toBe(REMOTE_FAILURE.NO_CONNECTION)
		expect(remoteFailureOf(new ApiProblemError(NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND))).toBe(
			REMOTE_FAILURE.SERVER_ERROR,
		)
		expect(isRetryable(REMOTE_FAILURE.SERVER_ERROR)).toBe(true)
	})
})
