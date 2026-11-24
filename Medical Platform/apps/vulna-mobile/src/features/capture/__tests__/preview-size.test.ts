import { describe, expect, it } from "vitest"
import { previewSizeOf } from "../preview-size"

const LONGEST_SIDE = 512

describe("previewSizeOf CAP-015-R10", () => {
	it("shrinks a landscape photo to the longest side and keeps its proportions", () => {
		expect(previewSizeOf(4000, 3000, LONGEST_SIDE)).toEqual({ width: 512, height: 384 })
	})

	it("shrinks a portrait photo by its height", () => {
		expect(previewSizeOf(3000, 4000, LONGEST_SIDE)).toEqual({ width: 384, height: 512 })
	})

	it("never enlarges a photo smaller than the preview", () => {
		expect(previewSizeOf(320, 240, LONGEST_SIDE)).toEqual({ width: 320, height: 240 })
	})
})
