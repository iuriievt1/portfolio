import { describe, expect, it } from "vitest"
import { EDIT_KIND, mergedEditKindOf } from "../entities/acquisition-file"
import { wasSessionRunningAt } from "../entities/operator-session"

// CAP-015-R34
describe("edit kind of a replaced file", () => {
	it("merges a crop after a rotation", () => {
		expect(mergedEditKindOf(EDIT_KIND.ROTATION, EDIT_KIND.CROP)).toBe(EDIT_KIND.ROTATION_AND_CROP)
	})

	it("keeps the first edit and a repeated one", () => {
		expect(mergedEditKindOf(null, EDIT_KIND.CROP)).toBe(EDIT_KIND.CROP)
		expect(mergedEditKindOf(EDIT_KIND.CROP, EDIT_KIND.CROP)).toBe(EDIT_KIND.CROP)
	})
})

// CAP-021-R13, CAP-019-R29
describe("session of the operator at a moment", () => {
	const session = {
		startedAt: new Date("2026-10-07T07:00:00Z"),
		sessionEnd: new Date("2026-10-07T15:00:00Z"),
		endedAt: new Date("2026-10-07T08:00:00Z"),
	}

	it("ran from its start until it ended", () => {
		expect(wasSessionRunningAt(session, new Date("2026-10-07T07:00:00Z"))).toBe(true)
		expect(wasSessionRunningAt(session, new Date("2026-10-07T07:59:59Z"))).toBe(true)
	})

	it("did not run before its start or once it ended", () => {
		expect(wasSessionRunningAt(session, new Date("2026-10-07T06:59:59Z"))).toBe(false)
		expect(wasSessionRunningAt(session, new Date("2026-10-07T08:00:00Z"))).toBe(false)
	})

	it("did not run past its end of life even when nobody ended it", () => {
		const open = { ...session, endedAt: null }

		expect(wasSessionRunningAt(open, new Date("2026-10-07T14:59:59Z"))).toBe(true)
		expect(wasSessionRunningAt(open, new Date("2026-10-07T15:00:00Z"))).toBe(false)
	})
})
