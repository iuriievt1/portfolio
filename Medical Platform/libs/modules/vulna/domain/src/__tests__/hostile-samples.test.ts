import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { dicomImageStreamOf } from "../dicom/image-stream"
import { DICOM_MAPPING_FAILURE, DicomMappingError } from "../dicom/mapping-error"
import { isJpegStream, withoutMetadata } from "../jpeg/jpeg-stream"

// Q-040, ADR-024, kvalita-rizika-a-pouzitelnost.md 7.1
const HOSTILE_DIRECTORY = resolve(__dirname, "../../../../../../quality/data/synteticka-sada/hostile")
const END_OF_IMAGE = Buffer.from([0xff, 0xd9])
const ZIP_LOCAL_HEADER = Buffer.from("PK\u0003\u0004", "latin1")

function sampleOf(name: string): Buffer {
	return readFileSync(resolve(HOSTILE_DIRECTORY, name))
}

function failureOf(jpeg: Uint8Array): string | undefined {
	try {
		dicomImageStreamOf(jpeg)
		return undefined
	} catch (error) {
		return error instanceof DicomMappingError ? error.failure : String(error)
	}
}

describe("hostile samples of the synthetic set ADR-024, kvalita-rizika-a-pouzitelnost.md 7.1", () => {
	it.each(["executable.jpg", "executable.pdf", "script.jpg"])(
		"CAP-021-R07 takes %s for no JPEG stream by its first bytes",
		(name) => {
			expect(isJpegStream(sampleOf(name))).toBe(false)
		},
	)

	it("integrace-dicom.md 3.1 refuses the progressive JPEG for a DICOM object without decoding it", () => {
		const progressive = sampleOf("progressive.jpg")

		expect(isJpegStream(progressive)).toBe(true)
		expect(failureOf(progressive)).toBe(DICOM_MAPPING_FAILURE.UNSUPPORTED_IMAGE)
	})

	it("CAP-021-S07 builds the DICOM image stream of the polyglot without the archive after the end of the image", () => {
		const polyglot = sampleOf("polyglot.jpg")

		const stream = Buffer.from(dicomImageStreamOf(polyglot).bytes)

		expect(polyglot.includes(ZIP_LOCAL_HEADER)).toBe(true)
		expect(stream.includes(ZIP_LOCAL_HEADER)).toBe(false)
		expect(stream.subarray(-END_OF_IMAGE.length)).toEqual(END_OF_IMAGE)
	})

	it("CAP-021-R07 leaves the archive of the polyglot out of the page that goes into the PDF", () => {
		const page = withoutMetadata(sampleOf("polyglot.jpg"))

		expect(page).toBeDefined()
		expect(Buffer.from(page ?? []).includes(ZIP_LOCAL_HEADER)).toBe(false)
	})
})
