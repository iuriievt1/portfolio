import { beforeEach, describe, expect, it } from "vitest"
import {
	awaitClosingBeforeSignOut,
	forgetSignOutResume,
	resumeSignOutAfterClosing,
	stopAwaitingClosing,
	takeResumedSignOut,
} from "../sign-out-resume"

const RECORD = "00000000-0000-4000-8000-000000000001"
const OTHER_RECORD = "00000000-0000-4000-8000-000000000002"

describe("sign-out after the record is closed through the summary CAP-015-S09", () => {
	beforeEach(() => forgetSignOutResume())

	it("goes on with the sign-out once the server closed the awaited record", () => {
		awaitClosingBeforeSignOut(RECORD)

		expect(resumeSignOutAfterClosing(RECORD)).toBe(true)
		expect(takeResumedSignOut()).toBe(true)
		expect(takeResumedSignOut()).toBe(false)
	})

	it("does not sign out after another record is closed", () => {
		awaitClosingBeforeSignOut(RECORD)

		expect(resumeSignOutAfterClosing(OTHER_RECORD)).toBe(false)
		expect(takeResumedSignOut()).toBe(false)
	})

	it("does not sign out once the nurse left the record without closing it", () => {
		awaitClosingBeforeSignOut(RECORD)
		stopAwaitingClosing(RECORD)

		expect(resumeSignOutAfterClosing(RECORD)).toBe(false)
	})

	it("CAP-002-R21 does not sign out after the app was locked", () => {
		awaitClosingBeforeSignOut(RECORD)
		forgetSignOutResume()

		expect(resumeSignOutAfterClosing(RECORD)).toBe(false)
	})
})
