import { describe, expect, it } from "vitest"
import { dicomImageStreamOf } from "../dicom/image-stream"
import { DICOM_MAPPING_FAILURE } from "../dicom/mapping-error"
import {
	ADOBE,
	adobeWith,
	baselineJpegOf,
	COMMENT,
	EXTENDED,
	exifWith,
	FRAME,
	frameOf,
	GAIN_MAP,
	GPS_EXIF,
	HUFFMAN,
	ICC,
	JFIF,
	jpegOf,
	NO_TRANSFORM,
	PROGRESSIVE,
	QUANTIZATION,
	SCAN,
	ZIP_ARCHIVE,
} from "./jpeg-bytes"

function refusal(failure: string) {
	return expect.objectContaining({ failure })
}

// integrace-dicom.md 3.1, 5.5, CAP-021-R07
describe("DICOM image stream", () => {
	it("CAP-021-S07 drops Exif with GPS, comments and the bytes after EOI and keeps the colour profile and the image", () => {
		const received = Uint8Array.from([...baselineJpegOf(JFIF, GPS_EXIF, ICC, ADOBE, COMMENT), ...GAIN_MAP])

		expect(dicomImageStreamOf(received).bytes).toEqual(baselineJpegOf(ICC))
	})

	it("kvalita-rizika-a-pouzitelnost.md 7.1 cuts a ZIP archive appended after the end of the image", () => {
		const clean = baselineJpegOf()

		expect(dicomImageStreamOf(Uint8Array.from([...clean, ...ZIP_ARCHIVE])).bytes).toEqual(clean)
	})

	it("CAP-021-S02 keeps a clean stream byte for byte", () => {
		const clean = baselineJpegOf(ICC)

		expect(dicomImageStreamOf(clean).bytes).toEqual(clean)
	})

	it("integrace-dicom.md 3.1 describes a colour baseline JPEG as YBR_FULL_422 of 8 bits by pixel", () => {
		expect(dicomImageStreamOf(baselineJpegOf(JFIF, exifWith(1), ADOBE)).pixels).toEqual({
			rows: 1754,
			columns: 1240,
			samplesPerPixel: 3,
			photometricInterpretation: "YBR_FULL_422",
			planarConfiguration: 0,
			bitsAllocated: 8,
			bitsStored: 8,
			highBit: 7,
			pixelRepresentation: 0,
			lossyImageCompression: "01",
			lossyImageCompressionMethod: "ISO_10918_1",
		})
	})

	it("DICOM PS3.5 8.2.1 describes a grey baseline JPEG as MONOCHROME2 without Planar Configuration", () => {
		const grey = jpegOf(adobeWith(NO_TRANSFORM), QUANTIZATION, HUFFMAN, frameOf(undefined, { componentCount: 1 }), SCAN)
		const { pixels } = dicomImageStreamOf(grey)

		expect(pixels).toMatchObject({ samplesPerPixel: 1, photometricInterpretation: "MONOCHROME2" })
		expect(pixels.planarConfiguration).toBeUndefined()
	})

	it("CAP-021-R07 refuses a turned image by its Exif Orientation (negative)", () => {
		expect(() => dicomImageStreamOf(baselineJpegOf(exifWith(6)))).toThrow(refusal(DICOM_MAPPING_FAILURE.ROTATED_IMAGE))
	})

	it.each([
		["a progressive JPEG", jpegOf(QUANTIZATION, HUFFMAN, frameOf(PROGRESSIVE), SCAN)],
		["an extended JPEG", jpegOf(QUANTIZATION, HUFFMAN, frameOf(EXTENDED), SCAN)],
		["a baseline frame of 12 bits", jpegOf(QUANTIZATION, HUFFMAN, frameOf(undefined, { precision: 12 }), SCAN)],
		["a JPEG with two components", jpegOf(QUANTIZATION, HUFFMAN, frameOf(undefined, { componentCount: 2 }), SCAN)],
		["a frame of no rows", jpegOf(QUANTIZATION, HUFFMAN, frameOf(undefined, { rows: 0 }), SCAN)],
		["a frame of no columns", jpegOf(QUANTIZATION, HUFFMAN, frameOf(undefined, { columns: 0 }), SCAN)],
		["colour stored as RGB by the Adobe transform", baselineJpegOf(adobeWith(NO_TRANSFORM))],
		["a JPEG without a frame", jpegOf(QUANTIZATION, HUFFMAN, SCAN)],
		["a JPEG with two frames", jpegOf(QUANTIZATION, HUFFMAN, FRAME, SCAN, frameOf(PROGRESSIVE), SCAN)],
		["a JPEG cut before its end", baselineJpegOf().subarray(0, 40)],
		["a PNG", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
		["an executable named as an image", Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0])],
		["a shell script named as an image", new TextEncoder().encode("#!/bin/sh\nrm -rf /\n")],
	])(
		"integrace-dicom.md 3.1, kvalita-rizika-a-pouzitelnost.md 7.1 refuses %s without decoding it (negative)",
		(_, image) => {
			expect(() => dicomImageStreamOf(image)).toThrow(refusal(DICOM_MAPPING_FAILURE.UNSUPPORTED_IMAGE))
		},
	)
})
