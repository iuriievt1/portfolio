import { describe, expect, it } from "vitest"
import { metadataOf, ORIENTATION, withSegments } from "../utils/jpeg-segments"
import { exifSegment, iccSegment, jpegOf, rasterOf, withLeading } from "./jpeg-fixtures"

const GREY = [128, 128, 128] as const
const PLAIN = jpegOf(rasterOf(4, 2, () => GREY))
const UNKNOWN_ORIENTATION = 9

describe("JPEG metadata of the original CAP-021-R40", () => {
	it("reads the EXIF orientation of a little-endian and a big-endian TIFF header", () => {
		expect(metadataOf(withLeading(PLAIN, [exifSegment(ORIENTATION.ROTATED_90)])).orientation).toBe(
			ORIENTATION.ROTATED_90,
		)
		expect(metadataOf(withLeading(PLAIN, [exifSegment(ORIENTATION.ROTATED_270, false)])).orientation).toBe(
			ORIENTATION.ROTATED_270,
		)
	})

	it("takes a photo without EXIF or with an unknown orientation as upright", () => {
		expect(metadataOf(PLAIN)).toEqual({ orientation: ORIENTATION.NORMAL, iccSegments: [] })
		expect(metadataOf(withLeading(PLAIN, [exifSegment(UNKNOWN_ORIENTATION)])).orientation).toBe(ORIENTATION.NORMAL)
	})

	it("keeps the colour profile segment byte for byte", () => {
		const icc = iccSegment()

		const metadata = metadataOf(withLeading(PLAIN, [exifSegment(ORIENTATION.NORMAL), icc]))

		expect(metadata.iccSegments.map((segment) => Buffer.from(segment))).toEqual([icc])
	})

	it("stops at the start of scan, so image data is never read as a segment", () => {
		const endOfImage = PLAIN.subarray(PLAIN.length - 2)
		const exifInScan = Buffer.concat([
			PLAIN.subarray(0, PLAIN.length - 2),
			exifSegment(ORIENTATION.ROTATED_90),
			endOfImage,
		])

		expect(metadataOf(exifInScan).orientation).toBe(ORIENTATION.NORMAL)
	})
})

describe("colour profile carried into the viewing copy CAP-021-R40", () => {
	it("puts the colour profile right after the JFIF header", () => {
		const icc = iccSegment()

		const copy = withSegments(PLAIN, [icc])

		expect(copy.subarray(20, 20 + icc.length)).toEqual(icc)
		expect(metadataOf(copy).iccSegments.map((segment) => Buffer.from(segment))).toEqual([icc])
		expect(copy.length).toBe(PLAIN.length + icc.length)
	})
})
