import { describe, expect, it } from "vitest"
import { cropOf, shownPhoto, wholeBoxOf } from "../crop-geometry"

const PHOTO = { width: 3024, height: 4032 }
const PORTRAIT_FRAME = { width: 393, height: 524 }

describe("crop of a photo CAP-015-R34", () => {
	it("CAP-015-R34 shows the whole photo centred in the frame", () => {
		const shown = shownPhoto({ width: 400, height: 400 }, PHOTO)

		expect(shown.left).toBeCloseTo(50)
		expect(shown.top).toBe(0)
		expect(shown.width).toBeCloseTo(300)
		expect(shown.height).toBe(400)
	})

	it("CAP-015-R34 crops nothing when the box was not moved", () => {
		const shown = shownPhoto(PORTRAIT_FRAME, PHOTO)

		expect(cropOf(wholeBoxOf(shown), shown)).toBeUndefined()
	})

	it("CAP-015-R34 CAP-015-R03 turns the box into pixels of the full photo", () => {
		const shown = shownPhoto({ width: 400, height: 400 }, PHOTO)
		const box = { left: 50 + 75, top: 100, right: 50 + 225, bottom: 300 }

		const crop = cropOf(box, shown)

		expect(crop?.x).toBeCloseTo(756)
		expect(crop?.y).toBeCloseTo(1008)
		expect(crop?.width).toBeCloseTo(1512)
		expect(crop?.height).toBeCloseTo(2016)
	})
})
