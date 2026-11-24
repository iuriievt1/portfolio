import { describe, expect, it } from "vitest"
import { INSTANCE_TIME_ZONE, momentOfDayTime } from "../registry/day-interval"

// CAP-014-R16, CAP-014-S13
describe("wall-clock time of the instance as an instant", () => {
	it("applies summer and winter time of the instance", () => {
		expect(momentOfDayTime("2026-10-07", "09:30:00", INSTANCE_TIME_ZONE)).toBe("2026-10-07T07:30:00.000Z")
		expect(momentOfDayTime("2026-12-07", "09:30:00", INSTANCE_TIME_ZONE)).toBe("2026-12-07T08:30:00.000Z")
	})

	it("keeps the time of the day across the change of the clock", () => {
		expect(momentOfDayTime("2026-10-25", "01:30:00", INSTANCE_TIME_ZONE)).toBe("2026-10-24T23:30:00.000Z")
		expect(momentOfDayTime("2026-10-25", "03:30:00", INSTANCE_TIME_ZONE)).toBe("2026-10-25T02:30:00.000Z")
	})
})
