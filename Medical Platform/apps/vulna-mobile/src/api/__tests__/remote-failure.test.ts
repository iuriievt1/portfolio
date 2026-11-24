import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { ApiProblemError } from "../api-error"
import { REMOTE_FAILURE, remoteFailureOf } from "../remote-failure"

const SERVICE_UNAVAILABLE = 503
const SERVER_FAILURE = 500

describe("remoteFailureOf", () => {
	it("CAP-002-R17 reads a request that never got an answer as no connection", () => {
		expect(remoteFailureOf(new TypeError("Network request failed"))).toBe(REMOTE_FAILURE.NO_CONNECTION)
	})

	it("reads an answer of the server as a server error, not as no connection", () => {
		expect(remoteFailureOf(new ApiProblemError(SERVER_FAILURE, undefined))).toBe(REMOTE_FAILURE.SERVER_ERROR)
	})

	it("tells the unavailable documentation apart from a server error", () => {
		expect(remoteFailureOf(new ApiProblemError(SERVICE_UNAVAILABLE, ERROR_CODE.DOCUMENTATION_UNAVAILABLE))).toBe(
			REMOTE_FAILURE.DOCUMENTATION_UNAVAILABLE,
		)
	})
})
