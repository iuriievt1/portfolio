import { describe, expect, it } from "vitest"
import {
	draftFilterOf,
	draftFilterParams,
	draftQueryOf,
	isStale,
	staleDraftsPath,
} from "@/features/drafts/lib/draft-view"

const DAY_SECONDS = 86_400
const REMINDER_SECONDS = 30 * DAY_SECONDS
const NOW = new Date("2026-10-16T12:00:00.000Z")
const OPERATOR = "11111111-1111-4111-8111-111111111111"

describe("view of the draft list CAP-004-R14", () => {
	it("keeps the operator and the age in the address", () => {
		const filter = { operatorUserId: OPERATOR, isStaleOnly: true }

		expect(draftFilterOf(new URLSearchParams(draftFilterParams(filter)))).toEqual(filter)
		expect(draftFilterOf(new URLSearchParams())).toEqual({ operatorUserId: undefined, isStaleOnly: false })
	})

	it("CAP-015-S43 asks only for drafts not changed within the reminder time", () => {
		const query = draftQueryOf({ operatorUserId: undefined, isStaleOnly: true }, REMINDER_SECONDS, NOW)

		expect(query.notUpdatedSince).toBe("2026-09-16T12:00:00.000Z")
		expect(draftQueryOf({ operatorUserId: OPERATOR, isStaleOnly: false }, REMINDER_SECONDS, NOW)).toEqual({
			operatorUserId: OPERATOR,
			notUpdatedSince: undefined,
		})
	})

	it("CAP-026-R16 marks a draft untouched for longer than the reminder time", () => {
		expect(isStale("2026-09-15T12:00:00.000Z", REMINDER_SECONDS, NOW)).toBe(true)
		expect(isStale("2026-10-15T12:00:00.000Z", REMINDER_SECONDS, NOW)).toBe(false)
		expect(isStale("2026-09-15T12:00:00.000Z", undefined, NOW)).toBe(false)
	})

	it("links the stale drafts alert to the filtered list", () => {
		expect(staleDraftsPath()).toBe("/drafts?age=stale")
	})
})
