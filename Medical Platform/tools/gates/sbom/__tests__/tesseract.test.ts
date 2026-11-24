import { describe, expect, it } from "vitest"
import { type Component, newBom } from "../cyclonedx"
import { checkLanguageModels, checkTesseractVersions } from "../tesseract"

const LOCATION = "/usr/local/bin/tesseract"
const VERSION_OUTPUT =
	"tesseract 5.5.4\n leptonica-1.87.0\n  libjpeg 6b (libjpeg-turbo 2.1.5) : libpng 1.6.48 : zlib 1.3.1\n"
const CZECH = "/usr/share/tesseract-ocr/5/tessdata/ces.traineddata"
const ENGLISH = "/usr/share/tesseract-ocr/5/tessdata/eng.traineddata"
const CZECH_SHA256 = "c".repeat(64)
const ENGLISH_SHA256 = "e".repeat(64)

function componentOf(name: string, version: string): Component {
	return { "bom-ref": `pkg:github/${name}@${version}`, type: "application", name, version }
}

function bomOf(components: Component[]) {
	return newBom(
		{ "bom-ref": "p", type: "container", name: "Ansora Vulna Server", version: "1" },
		[],
		components,
		new Date(0),
	)
}

describe("B8 Tesseract version", () => {
	it("vydani-sbom-a-brany.md 2.2 passes when the SBOM carries the Tesseract and Leptonica of the image", () => {
		const bom = bomOf([componentOf("tesseract", "5.5.4"), componentOf("leptonica", "1.87.0")])

		expect(checkTesseractVersions(LOCATION, VERSION_OUTPUT, bom)).toEqual([])
	})

	it("CAP-029-S02 fails when the image carries another Tesseract than the SBOM", () => {
		const bom = bomOf([componentOf("tesseract", "5.5.3"), componentOf("leptonica", "1.87.0")])

		expect(checkTesseractVersions(LOCATION, VERSION_OUTPUT, bom)).toEqual([
			{ gate: "B8", what: "tesseract@5.5.4", reason: "version in the image missing from the SBOM" },
		])
	})

	it("CAP-029-S02 fails when only Leptonica differs from the SBOM", () => {
		const bom = bomOf([componentOf("tesseract", "5.5.4"), componentOf("leptonica", "1.86.0")])

		expect(checkTesseractVersions(LOCATION, VERSION_OUTPUT, bom).map((finding) => finding.what)).toEqual([
			"leptonica@1.87.0",
		])
	})

	it("CAP-029-S02 fails when another component carries the version of the image", () => {
		const bom = bomOf([componentOf("leptonica", "5.5.4"), componentOf("tesseract", "1.87.0")])

		expect(checkTesseractVersions(LOCATION, VERSION_OUTPUT, bom).map((finding) => finding.what)).toEqual([
			"tesseract@5.5.4",
			"leptonica@1.87.0",
		])
	})

	it("CAP-029-S02 fails when the SBOM carries only the start of the version", () => {
		const bom = bomOf([componentOf("tesseract", "5.5"), componentOf("leptonica", "1.87")])

		expect(checkTesseractVersions(LOCATION, VERSION_OUTPUT, bom)).toHaveLength(2)
	})

	it("ADR-011 ř. 46 fails when the image has no Tesseract to ask", () => {
		const bom = bomOf([componentOf("tesseract", "5.5.4"), componentOf("leptonica", "1.87.0")])

		expect(checkTesseractVersions(LOCATION, "", bom)).toEqual([
			{ gate: "B8", what: LOCATION, reason: "tesseract in the image reports no version" },
			{ gate: "B8", what: LOCATION, reason: "leptonica in the image reports no version" },
		])
	})
})

describe("B8 language models", () => {
	const recorded = new Map([
		[CZECH, CZECH_SHA256],
		[ENGLISH, ENGLISH_SHA256],
	])
	const owned = new Set([CZECH, ENGLISH])

	it("vydani-sbom-a-brany.md 2.2 passes when the image carries the recorded models of its packages", () => {
		expect(checkLanguageModels(recorded, new Map(recorded), owned)).toEqual([])
	})

	it("ADR-011 ř. 46 fails a model whose bytes differ from the recorded SHA-256", () => {
		const present = new Map([
			[CZECH, "0".repeat(64)],
			[ENGLISH, ENGLISH_SHA256],
		])

		expect(checkLanguageModels(recorded, present, owned)).toEqual([
			{ gate: "B8", what: CZECH, reason: "language model differs from its recorded SHA-256" },
		])
	})

	it("ADR-011 ř. 46 fails a recorded model the image lacks", () => {
		expect(checkLanguageModels(recorded, new Map([[ENGLISH, ENGLISH_SHA256]]), owned)).toEqual([
			{ gate: "B8", what: CZECH, reason: "language model missing from the image" },
		])
	})

	it("CAP-029-S02 fails a model that no package of the SBOM owns", () => {
		expect(checkLanguageModels(recorded, new Map(recorded), new Set([ENGLISH]))).toEqual([
			{ gate: "B8", what: CZECH, reason: "language model of no package in the SBOM" },
		])
	})

	it("CAP-029-S02 fails a model in the image that has no recorded SHA-256", () => {
		const foreign = "/usr/share/tesseract-ocr/5/tessdata/deu.traineddata"
		const present = new Map([...recorded, [foreign, "d".repeat(64)]])

		expect(checkLanguageModels(recorded, present, new Set([...owned, foreign]))).toEqual([
			{ gate: "B8", what: foreign, reason: "language model without a recorded SHA-256" },
		])
	})
})
