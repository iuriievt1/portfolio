import { describe, expect, it } from "vitest"
import { isAtLimit } from "../shot-limit"

const PHOTO_LIMIT = 5

describe("photos of a wound record CAP-015-R13", () => {
	it("stops at the photo limit of the instance", () => {
		expect(isAtLimit(PHOTO_LIMIT - 1, PHOTO_LIMIT)).toBe(false)
		expect(isAtLimit(PHOTO_LIMIT, PHOTO_LIMIT)).toBe(true)
	})

	it("CAP-015-S61 adds no photo to a record that already has more than a lowered limit", () => {
		expect(isAtLimit(PHOTO_LIMIT + 1, PHOTO_LIMIT)).toBe(true)
	})
})
