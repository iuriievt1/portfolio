import { describe, expect, it } from "vitest"
import { REMOTE_FAILURE } from "../../../api/remote-failure"
import { type ChosenChange, closesOnDismiss, IDLE, stepAfterConflict, TYPE_CHANGE } from "../type-change"

const CHANGE: ChosenChange = { previous: "pressure-ulcer", next: "venous-ulcer", version: "3" }

describe("stepAfterConflict", () => {
	it("CAP-020-R21 asks again with the type the finding carries now", () => {
		expect(stepAfterConflict(CHANGE, "traumatic")).toEqual({
			kind: TYPE_CHANGE.CONFIRMING,
			previous: "traumatic",
			next: "venous-ulcer",
			version: "3",
			hasChangedMeanwhile: true,
		})
	})

	it("CAP-020-R21 asks nothing when the finding already carries the chosen type", () => {
		expect(stepAfterConflict(CHANGE, "venous-ulcer")).toEqual(IDLE)
	})

	it("CAP-020-S26 never confirms a change from an unknown type", () => {
		expect(stepAfterConflict(CHANGE, undefined)).toEqual({
			kind: TYPE_CHANGE.FAILED,
			failure: REMOTE_FAILURE.SERVER_ERROR,
		})
	})
})

describe("closesOnDismiss", () => {
	it("CAP-020-S03 leaves the type change of a finding the server no longer gives out", () => {
		expect(closesOnDismiss({ kind: TYPE_CHANGE.FAILED, failure: REMOTE_FAILURE.NOT_FOUND })).toBe(true)
	})

	it("CAP-002-R17 stays on the type change after a lost connection", () => {
		expect(closesOnDismiss({ kind: TYPE_CHANGE.FAILED, failure: REMOTE_FAILURE.NO_CONNECTION })).toBe(false)
		expect(closesOnDismiss({ kind: TYPE_CHANGE.CONFIRMING, ...CHANGE, hasChangedMeanwhile: false })).toBe(false)
	})
})
