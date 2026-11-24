import { describe, expect, it } from "vitest"
import { calendarDayIn, dayCountOf, halvesOf, INSTANCE_TIME_ZONE, syncWindowOf } from "../registry/day-interval"

describe("registry sync window CAP-024-R14", () => {
	it("spans today minus the days back to today plus the days ahead", () => {
		expect(syncWindowOf("2026-10-06", 7, 1)).toEqual({ from: "2026-09-29", to: "2026-10-07" })
	})

	it("crosses month and year ends", () => {
		expect(syncWindowOf("2027-01-01", 1, 0)).toEqual({ from: "2026-12-31", to: "2027-01-01" })
	})

	it("takes today in the instance time zone, not in UTC", () => {
		expect(calendarDayIn(INSTANCE_TIME_ZONE, new Date("2026-10-06T22:30:00Z"))).toBe("2026-10-07")
	})

	it("counts both ends of the interval", () => {
		expect(dayCountOf({ from: "2026-10-01", to: "2026-10-07" })).toBe(7)
	})
})

describe("halving after A700 CAP-024-S03", () => {
	it("splits the interval into two adjoining halves", () => {
		expect(halvesOf({ from: "2026-10-01", to: "2026-10-07" })).toEqual([
			{ from: "2026-10-01", to: "2026-10-03" },
			{ from: "2026-10-04", to: "2026-10-07" },
		])
	})

	it("stops at one day", () => {
		expect(halvesOf({ from: "2026-10-01", to: "2026-10-01" })).toBeUndefined()
	})
})
