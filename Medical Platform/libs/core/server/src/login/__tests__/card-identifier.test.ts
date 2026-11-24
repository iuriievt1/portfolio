import { describe, expect, it } from "vitest"
import { shortCardUid } from "../card-identifier"

describe("shortCardUid", () => {
	it("shows the tail of the identifier", () => {
		expect(shortCardUid("04a1b2c3d4e5f6")).toBe("D4E5F6")
		expect(shortCardUid("ab")).toBe("AB")
	})
})
