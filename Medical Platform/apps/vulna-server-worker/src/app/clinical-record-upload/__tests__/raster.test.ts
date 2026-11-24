import { describe, expect, it } from "vitest"
import { ORIENTATION, type Orientation } from "../utils/jpeg-segments"
import { downscaled, type Raster, targetSizeOf, upright } from "../utils/raster"
import { rasterOf } from "./jpeg-fixtures"

const CHANNELS = 4
const BLACK = [0, 0, 0] as const
const WHITE = [255, 255, 255] as const
// IEC 61966-2-1: half of the light of white, encoded back to sRGB
const HALF_LIGHT = 188
const GREY = 128

// stored A B / C D
const LETTERS = rasterOf(2, 2, (x, y) => [y * 2 + x, 0, 0])
const A = 0
const B = 1
const C = 2
const D = 3

function idsOf(raster: Raster): number[] {
	return Array.from({ length: raster.width * raster.height }, (_, pixel) => raster.data[pixel * CHANNELS] ?? -1)
}

describe("size of the viewing copy CAP-021-R40", () => {
	it("fits the longer edge into the configured limit and keeps the proportions", () => {
		expect(targetSizeOf({ width: 3456, height: 4624 }, 2048)).toEqual({ width: 1531, height: 2048 })
		expect(targetSizeOf({ width: 4624, height: 3456 }, 2048)).toEqual({ width: 2048, height: 1531 })
	})

	it("never enlarges a photo smaller than the limit", () => {
		const small = rasterOf(3, 2, () => WHITE)

		expect(targetSizeOf(small, 2048)).toEqual({ width: 3, height: 2 })
		expect(downscaled(small, 2048)).toBe(small)
	})
})

describe("downscaling in linear light CAP-021-R40, IEC 61966-2-1", () => {
	it("keeps a uniform colour unchanged", () => {
		const copy = downscaled(
			rasterOf(8, 4, () => [GREY, GREY, GREY]),
			2,
		)

		expect(copy.width).toBe(2)
		expect(copy.height).toBe(1)
		expect([...copy.data]).toEqual([GREY, GREY, GREY, 255, GREY, GREY, GREY, 255])
	})

	it("averages light, not encoded values, so fine detail does not darken", () => {
		const copy = downscaled(
			rasterOf(2, 1, (x) => (x === 0 ? BLACK : WHITE)),
			1,
		)

		expect([...copy.data]).toEqual([HALF_LIGHT, HALF_LIGHT, HALF_LIGHT, 255])
	})
})

describe("EXIF orientation applied to the pixels CAP-021-R40, EXIF 2.3 4.6.4", () => {
	const cases: ReadonlyArray<readonly [Orientation, readonly number[]]> = [
		[ORIENTATION.NORMAL, [A, B, C, D]],
		[ORIENTATION.MIRRORED, [B, A, D, C]],
		[ORIENTATION.ROTATED_180, [D, C, B, A]],
		[ORIENTATION.FLIPPED, [C, D, A, B]],
		[ORIENTATION.TRANSPOSED, [A, C, B, D]],
		[ORIENTATION.ROTATED_90, [C, A, D, B]],
		[ORIENTATION.TRANSVERSED, [D, B, C, A]],
		[ORIENTATION.ROTATED_270, [B, D, A, C]],
	]

	it.each(cases)("turns orientation %i upright", (orientation, expected) => {
		expect(idsOf(upright(LETTERS, orientation))).toEqual(expected)
	})

	it("swaps width and height of a photo taken on its side", () => {
		const portrait = upright(
			rasterOf(4, 2, () => WHITE),
			ORIENTATION.ROTATED_90,
		)

		expect({ width: portrait.width, height: portrait.height }).toEqual({ width: 2, height: 4 })
	})
})
