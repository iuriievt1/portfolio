import { describe, expect, it } from "vitest"
import { checksumsOf } from "../checksums"

const LEPTONICA_SHA256 = "c73363397f96eb1295602bf44d708a994ad42046c791bf03ea0505d829bdb6a7"
const TESSERACT_SHA256 = "a8dbf8b8c8ee427ff6ad1d99116502feaf59440af1adb893caf60a6576826cf4"

describe("checksumsOf", () => {
	it("ADR-011 ř. 49 reads the files and SHA-256 that sha256sum checks", () => {
		const text = `${LEPTONICA_SHA256}  leptonica-1.87.0.tar.gz\n${TESSERACT_SHA256}  tesseract-5.5.4.tar.gz\n`

		expect(checksumsOf(text)).toEqual(
			new Map([
				["leptonica-1.87.0.tar.gz", LEPTONICA_SHA256],
				["tesseract-5.5.4.tar.gz", TESSERACT_SHA256],
			]),
		)
	})

	it("ADR-011 ř. 49 refuses a line sha256sum would not check", () => {
		expect(() => checksumsOf(`${LEPTONICA_SHA256} leptonica-1.87.0.tar.gz\n`)).toThrow("not a sha256sum line")
	})
})
