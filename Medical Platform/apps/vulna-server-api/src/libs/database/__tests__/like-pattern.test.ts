import { describe, expect, it } from "vitest"
import { containing, startingWith } from "../like-pattern"

// CAP-013-R17, CHG-182
describe("LIKE pattern of a search text", () => {
	it("matches values starting with the text and nothing more, even when the text holds wildcards", () => {
		expect(startingWith("9%_")).toBe("9\\%\\_%")
		expect(startingWith("a\\b")).toBe("a\\\\b%")
	})

	it("matches values containing the text with the same escaping", () => {
		expect(containing("9%_")).toBe("%9\\%\\_%")
	})
})
