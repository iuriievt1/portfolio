import { describe, expect, it } from "vitest"
import {
	dayOfCalendarDate,
	deviceDateOf,
	formatCalendarDate,
	formatCalendarDayMonth,
	formatDate,
	formatDateTime,
	formatTime,
	instanceDateOf,
	isSameDay,
} from "../format-date"

describe("formatDateTime", () => {
	it("CAP-015-R28 formats Czech date and time in Prague time", () => {
		expect(formatDateTime(new Date("2026-07-31T06:05:00Z"), "cs")).toBe("31. 7. 2026 8:05")
	})

	it("CAP-015-R28 follows the convention of another language", () => {
		expect(formatDateTime(new Date("2026-07-31T06:05:00Z"), "en")).toBe("7/31/2026, 8:05 AM")
	})
})

describe("formatDate and formatTime", () => {
	it("CAP-015-R28 split the moment into a Prague date and a Prague time", () => {
		const moment = new Date("2026-09-18T22:30:00Z")
		expect(formatDate(moment, "cs")).toBe("19. 9. 2026")
		expect(formatTime(moment, "cs")).toBe("0:30")
	})
})

describe("formatCalendarDate", () => {
	it("CAP-015-R28 keeps a birth date on its own day in any time zone", () => {
		expect(formatCalendarDate("1958-03-12", "cs")).toBe("12. 3. 1958")
		expect(formatCalendarDate("1958-03-12", "en")).toBe("3/12/1958")
	})

	it("leaves a value that is not a calendar date as it came", () => {
		expect(formatCalendarDate("unknown", "cs")).toBe("unknown")
	})
})

describe("formatCalendarDayMonth", () => {
	it("E120 names a day of the visit without its year", () => {
		expect(formatCalendarDayMonth("2026-09-16", "cs")).toBe("16. 9.")
		expect(dayOfCalendarDate("2026-09-16")).toBe(16)
		expect(dayOfCalendarDate("unknown")).toBeUndefined()
	})
})

describe("isSameDay", () => {
	it("compares days in Prague time, not in UTC", () => {
		expect(isSameDay(new Date("2026-09-18T22:30:00Z"), new Date("2026-09-19T10:00:00Z"))).toBe(true)
		expect(isSameDay(new Date("2026-09-18T21:30:00Z"), new Date("2026-09-19T10:00:00Z"))).toBe(false)
	})
})

describe("deviceDateOf", () => {
	it("writes the device's local date as the contract date", () => {
		expect(deviceDateOf(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05")
	})
})

describe("instanceDateOf", () => {
	it("CAP-014-R30 counts today in the instance time zone, not on the device", () => {
		expect(instanceDateOf(new Date("2026-09-18T22:30:00Z"))).toBe("2026-09-19")
		expect(instanceDateOf(new Date("2026-09-18T21:30:00Z"))).toBe("2026-09-18")
		expect(instanceDateOf(new Date("2026-01-05T08:00:00Z"))).toBe("2026-01-05")
	})
})
