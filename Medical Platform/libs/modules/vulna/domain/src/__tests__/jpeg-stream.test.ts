import { describe, expect, it } from "vitest"
import {
	adobeTransformOf,
	exifOrientationOf,
	isJpegStream,
	jpegFrameOf,
	withColourProfileOnly,
	withoutMetadata,
} from "../jpeg/jpeg-stream"
import {
	ADOBE,
	ARITHMETIC_PROGRESSIVE,
	ascii,
	BASELINE,
	baselineJpegOf,
	COMMENT,
	EOI,
	EXTENDED,
	exifWith,
	FRAME,
	frameOf,
	GPS_EXIF,
	HIERARCHY,
	HUFFMAN,
	ICC,
	JFIF,
	JFIF_WITH_THUMBNAIL,
	JFXX,
	jpegOf,
	LONG_TYPE,
	LOSSLESS,
	MPF,
	NO_TRANSFORM,
	PROGRESSIVE,
	QUANTIZATION,
	SCAN,
	SOI,
	segmentOf,
	XMP,
	YCBCR_TRANSFORM,
} from "./jpeg-bytes"

const FILL = [0xff, 0xff]

// CAP-021-R07
describe("Exif orientation read without decoding the image", () => {
	it("reads the orientation of a big endian Exif", () => {
		expect(exifOrientationOf(baselineJpegOf(exifWith(6)))).toBe(6)
	})

	it("reads the orientation of a little endian Exif", () => {
		expect(exifOrientationOf(baselineJpegOf(exifWith(3, { isLittleEndian: true })))).toBe(3)
	})

	it("CIPA DC-008 4.6.4 reads an orientation written as LONG", () => {
		expect(exifOrientationOf(baselineJpegOf(exifWith(6, { type: LONG_TYPE })))).toBe(6)
	})

	it("CAP-015-R14 finds no orientation in a cleaned file", () => {
		expect(exifOrientationOf(baselineJpegOf())).toBeUndefined()
	})

	it("reads nothing from bytes that are not a JPEG", () => {
		expect(exifOrientationOf(new TextEncoder().encode("not a jpeg at all"))).toBeUndefined()
	})

	it("stops at a segment longer than the file", () => {
		expect(exifOrientationOf(baselineJpegOf(exifWith(6)).subarray(0, 12))).toBeUndefined()
	})

	it("reads a JPEG held in a view of a larger buffer", () => {
		const jpeg = baselineJpegOf(exifWith(8))
		const padded = new Uint8Array(jpeg.length + 16)
		padded.set(jpeg, 7)

		expect(exifOrientationOf(padded.subarray(7, 7 + jpeg.length))).toBe(8)
	})
})

// CAP-015-R04, clinical-workflow.yaml ImageUpload.image
describe("JPEG stream", () => {
	it("starts with the SOI marker", () => {
		expect(isJpegStream(baselineJpegOf())).toBe(true)
	})

	it("is not a PNG, text or empty bytes", () => {
		expect(isJpegStream(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false)
		expect(isJpegStream(new TextEncoder().encode("plain"))).toBe(false)
		expect(isJpegStream(new Uint8Array(0))).toBe(false)
	})
})

// NAB-479, CAP-015-R14
describe("JPEG stream without metadata for a PDF page", () => {
	it("drops Exif, XMP, MPF and comments and keeps the image", () => {
		expect(withoutMetadata(baselineJpegOf(JFIF, GPS_EXIF, XMP, MPF, COMMENT))).toEqual(baselineJpegOf(JFIF))
	})

	it("CAP-015-R14 keeps the colour profile and the Adobe colour transform", () => {
		expect(withoutMetadata(baselineJpegOf(ICC, ADOBE, GPS_EXIF))).toEqual(baselineJpegOf(ICC, ADOBE))
	})

	it("ITU-T T.871 10.1 keeps the JFIF density and drops its thumbnail and the JFXX extension", () => {
		expect(withoutMetadata(baselineJpegOf(JFIF_WITH_THUMBNAIL, JFXX))).toEqual(baselineJpegOf(JFIF))
	})

	it("drops the bytes after the end of the image", () => {
		const jpeg = baselineJpegOf(JFIF)

		expect(withoutMetadata(Uint8Array.from([...jpeg, ...ascii("hidden payload")]))).toEqual(jpeg)
	})

	it("keeps a file without metadata byte for byte", () => {
		const jpeg = baselineJpegOf(JFIF)

		expect(withoutMetadata(jpeg)).toEqual(jpeg)
	})

	it("drops metadata between the scans of a progressive image", () => {
		const jpeg = jpegOf(QUANTIZATION, HUFFMAN, frameOf(PROGRESSIVE), SCAN, COMMENT, SCAN)

		expect(withoutMetadata(jpeg)).toEqual(jpegOf(QUANTIZATION, HUFFMAN, frameOf(PROGRESSIVE), SCAN, SCAN))
	})

	it("refuses bytes that are not a whole JPEG stream", () => {
		const jpeg = baselineJpegOf(JFIF)

		expect(withoutMetadata(new TextEncoder().encode("not a jpeg at all"))).toBeUndefined()
		expect(withoutMetadata(jpeg.subarray(0, 8))).toBeUndefined()
		expect(withoutMetadata(jpeg.subarray(0, jpeg.length - EOI.length))).toBeUndefined()
	})
})

// CAP-021-R07, integrace-dicom.md 5.5, DICOM PS3.5 8.2.1
describe("JPEG stream for a DICOM object", () => {
	it("CAP-021-S07 keeps only the colour profile of all the metadata segments", () => {
		const received = baselineJpegOf(JFIF_WITH_THUMBNAIL, ICC, ADOBE, GPS_EXIF, XMP, MPF, COMMENT)

		expect(withColourProfileOnly(received)).toEqual(baselineJpegOf(ICC))
	})

	it("CAP-021-S07 keeps the image bytes from SOI to EOI, fill bytes included, and drops what follows", () => {
		const image = jpegOf(QUANTIZATION, FILL, HUFFMAN, FRAME, SCAN)
		const received = Uint8Array.from([...jpegOf(GPS_EXIF, QUANTIZATION, FILL, HUFFMAN, FRAME, SCAN), 0x50, 0x4b])

		expect(withColourProfileOnly(received)).toEqual(image)
	})

	it("refuses bytes that are not a whole JPEG stream", () => {
		expect(withColourProfileOnly(baselineJpegOf().subarray(0, 20))).toBeUndefined()
	})
})

// ITU-T T.872 6.5.3
describe("Adobe colour transform", () => {
	it("reads the transform of the Adobe segment", () => {
		expect(adobeTransformOf(baselineJpegOf(ADOBE))).toBe(YCBCR_TRANSFORM)
		expect(adobeTransformOf(baselineJpegOf(segmentOf(0xee, [...ascii("Adobe"), 0, 100, 0, 0, 0, 0, 0])))).toBe(
			NO_TRANSFORM,
		)
	})

	it("finds none without an Adobe segment", () => {
		expect(adobeTransformOf(baselineJpegOf(JFIF))).toBeUndefined()
	})
})

// ITU-T T.81 B.2, DICOM PS3.5 8.2.1, CAP-021-R07, integrace-dicom.md 3.1, 5.5
describe("JPEG frame read without decoding the image", () => {
	it("reads the size and the components of a baseline frame", () => {
		expect(jpegFrameOf(baselineJpegOf(JFIF, GPS_EXIF))).toEqual({
			isBaseline: true,
			precision: 8,
			rows: 1754,
			columns: 1240,
			componentCount: 3,
		})
	})

	it("takes a baseline image of several scans", () => {
		expect(jpegFrameOf(jpegOf(QUANTIZATION, HUFFMAN, FRAME, SCAN, HUFFMAN, SCAN))?.isBaseline).toBe(true)
	})

	it.each([
		["an extended sequential", EXTENDED],
		["a progressive", PROGRESSIVE],
		["a lossless", LOSSLESS],
		["an arithmetic progressive", ARITHMETIC_PROGRESSIVE],
	])("tells %s frame from a baseline one", (_, marker) => {
		expect(jpegFrameOf(jpegOf(QUANTIZATION, HUFFMAN, frameOf(marker), SCAN))?.isBaseline).toBe(false)
	})

	it("ITU-T T.81 B.3 tells a hierarchical image from a baseline one", () => {
		expect(jpegFrameOf(jpegOf(HIERARCHY, QUANTIZATION, HUFFMAN, FRAME, SCAN))?.isBaseline).toBe(false)
	})

	it("does not take a Huffman table of the length of a frame for a frame", () => {
		const huffmanLikeFrame = segmentOf(0xc4, frameOf(BASELINE, { componentCount: 1 }).slice(4))

		expect(jpegFrameOf(jpegOf(QUANTIZATION, huffmanLikeFrame, SCAN))).toBeUndefined()
	})

	it.each([
		[
			"a frame whose length does not match its components",
			jpegOf(QUANTIZATION, HUFFMAN, segmentOf(BASELINE, FRAME.slice(4, -3)), SCAN),
		],
		["two frames", jpegOf(QUANTIZATION, HUFFMAN, FRAME, FRAME, SCAN)],
		[
			"a progressive frame after the baseline one",
			jpegOf(QUANTIZATION, HUFFMAN, FRAME, SCAN, frameOf(PROGRESSIVE), SCAN),
		],
		["no scan", jpegOf(QUANTIZATION, HUFFMAN, FRAME)],
		["no quantization table", jpegOf(HUFFMAN, FRAME, SCAN)],
		["no Huffman table", jpegOf(QUANTIZATION, FRAME, SCAN)],
		["tables only after the first scan", jpegOf(FRAME, SCAN, QUANTIZATION, HUFFMAN, SCAN)],
		["bytes that are not a JPEG", new TextEncoder().encode("not a jpeg at all")],
		["a stream cut before its end", baselineJpegOf().subarray(0, 30)],
		[
			"a segment whose length cannot hold its own length",
			Uint8Array.from([...SOI, 0xff, 0xe1, 0, 1, ...FRAME, ...EOI]),
		],
	])("DICOM PS3.5 8.2.1 finds no frame in %s", (_, jpeg) => {
		expect(jpegFrameOf(jpeg)).toBeUndefined()
	})
})
