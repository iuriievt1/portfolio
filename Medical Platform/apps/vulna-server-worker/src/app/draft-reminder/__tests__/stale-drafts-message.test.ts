import { describe, expect, it } from "vitest"
import { czechDurationOf, staleDraftsMessageOf } from "../utils/stale-drafts-message"

describe("message of the stale drafts alert CAP-026-R16", () => {
	it("names the reminder time in Czech with the right plural", () => {
		expect(czechDurationOf(30 * 86_400)).toBe("30 dnů")
		expect(czechDurationOf(86_400)).toBe("1 den")
		expect(czechDurationOf(2 * 86_400)).toBe("2 dny")
		expect(czechDurationOf(36 * 3600)).toBe("36 hodin")
		expect(czechDurationOf(90)).toBe("90 sekund")
	})

	it("CAP-015-S43 says how many drafts wait and that nothing is deleted", () => {
		const message = staleDraftsMessageOf(3, 30 * 86_400)

		expect(message).toContain("déle než 30 dnů: 3.")
		expect(message).toContain("Nic se nemaže")
	})
})
