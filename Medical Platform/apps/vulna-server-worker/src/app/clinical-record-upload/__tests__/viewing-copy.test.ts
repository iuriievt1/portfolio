import { decode } from "jpeg-js"
import { describe, expect, it } from "vitest"
import { metadataOf, ORIENTATION } from "../utils/jpeg-segments"
import { viewingCopyOf } from "../utils/viewing-copy"
import { iccSegment, jpegOf, photoOf, rasterOf } from "./jpeg-fixtures"

const SETTINGS = { maxLongEdgePx: 16, quality: 70 }
const EXIF_SIGNATURE = Buffer.from("Exif\0\0", "latin1")
const RED = [220, 30, 30] as const
const BLUE = [30, 30, 220] as const
// jpeg-js quantisation noise at quality 70
const COLOUR_TOLERANCE = 12

// stored 64 × 32: left half red, right half blue
const SIDEWAYS = rasterOf(64, 32, (x) => (x < 32 ? RED : BLUE))

function pixelAt(jpeg: Buffer, x: number, y: number): number[] {
	const image = decode(jpeg, { useTArray: true, formatAsRGBA: true })
	const offset = (y * image.width + x) * 4
	return [...image.data.subarray(offset, offset + 3)]
}

function isNear(actual: readonly number[], expected: readonly number[]): boolean {
	return actual.every((value, channel) => Math.abs(value - (expected[channel] ?? 0)) <= COLOUR_TOLERANCE)
}

describe("viewing copy of a wound photo CAP-021-R40, ADR-050 bod 13", () => {
	it("shrinks the longer edge to the limit and turns a photo taken on its side upright", () => {
		const copy = viewingCopyOf(photoOf(SIDEWAYS, ORIENTATION.ROTATED_90), SETTINGS)

		const image = decode(copy, { useTArray: true })
		expect({ width: image.width, height: image.height }).toEqual({ width: 8, height: 16 })
		expect(isNear(pixelAt(copy, 4, 1), RED)).toBe(true)
		expect(isNear(pixelAt(copy, 4, 14), BLUE)).toBe(true)
	})

	it("drops EXIF with location and device data and keeps the colour profile", () => {
		const copy = viewingCopyOf(photoOf(SIDEWAYS, ORIENTATION.ROTATED_90), SETTINGS)

		expect(copy.includes(EXIF_SIGNATURE)).toBe(false)
		expect(metadataOf(copy)).toEqual({ orientation: ORIENTATION.NORMAL, iccSegments: [iccSegment()] })
	})

	it("keeps a photo smaller than the limit at its size", () => {
		const copy = viewingCopyOf(jpegOf(SIDEWAYS), { ...SETTINGS, maxLongEdgePx: 2048 })

		const image = decode(copy, { useTArray: true })
		expect({ width: image.width, height: image.height }).toEqual({ width: 64, height: 32 })
	})

	it("refuses bytes that are no JPEG, so the administrator learns of it", () => {
		expect(() => viewingCopyOf(Buffer.from("not a photo"), SETTINGS)).toThrow()
	})
})
