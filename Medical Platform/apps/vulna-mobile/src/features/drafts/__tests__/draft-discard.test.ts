import { DISCARD_SITUATION, ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { ApiProblemError } from "../../../api/api-error"
import { REMOTE_FAILURE } from "../../../api/remote-failure"
import { DRAFT_DISCARD, discardStateOfError, ownDraftsSituationOf } from "../draft-discard"

const NOT_FOUND = 404
const CONFLICT = 409
const SERVICE_UNAVAILABLE = 503

describe("discard of an own record in progress that did not happen", () => {
	it("CAP-021-R32 CAP-015-S41 says the record changed on another device and discards nothing", () => {
		expect(discardStateOfError(new ApiProblemError(CONFLICT, ERROR_CODE.ACQUISITION_VERSION_CONFLICT))).toEqual({
			kind: DRAFT_DISCARD.CHANGED,
		})
		expect(discardStateOfError(new ApiProblemError(CONFLICT, ERROR_CODE.ACQUISITION_CLOSED))).toEqual({
			kind: DRAFT_DISCARD.CHANGED,
		})
	})

	it("says the record changed when another device has already discarded it", () => {
		expect(discardStateOfError(new ApiProblemError(NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND))).toEqual({
			kind: DRAFT_DISCARD.CHANGED,
		})
	})

	it("ADR-054 tells the unavailable documentation from a lost connection", () => {
		expect(discardStateOfError(new ApiProblemError(SERVICE_UNAVAILABLE, ERROR_CODE.DOCUMENTATION_UNAVAILABLE))).toEqual(
			{ kind: DRAFT_DISCARD.FAILED, failure: REMOTE_FAILURE.DOCUMENTATION_UNAVAILABLE },
		)
		expect(discardStateOfError(new TypeError("Network request failed"))).toEqual({
			kind: DRAFT_DISCARD.FAILED,
			failure: REMOTE_FAILURE.NO_CONNECTION,
		})
	})
})

describe("situation of a discard from the list of own records in progress CAP-025-R20", () => {
	it("CAP-015-R16 records the sign-out when the list was opened from the sign-out warning", () => {
		expect(ownDraftsSituationOf(DISCARD_SITUATION.LOGOUT)).toBe(DISCARD_SITUATION.LOGOUT)
	})

	it("records an explicit discard otherwise, whatever else the address carries", () => {
		expect(ownDraftsSituationOf(undefined)).toBe(DISCARD_SITUATION.EXPLICIT_DISCARD)
		expect(ownDraftsSituationOf(DISCARD_SITUATION.REMINDER)).toBe(DISCARD_SITUATION.EXPLICIT_DISCARD)
	})
})
