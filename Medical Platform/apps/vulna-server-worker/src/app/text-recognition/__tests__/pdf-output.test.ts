import { describe, expect, it } from "vitest"
import { pdfProblemOf } from "../utils/pdf-output"
import { tesseractLikePdf } from "./pdf-fixtures"

describe("pdfProblemOf", () => {
	it("CAP-022-R05 accepts one PDF with a text layer over every page", () => {
		expect(pdfProblemOf(tesseractLikePdf(2), 2)).toBeUndefined()
	})

	it("ADR-018 refuses output that is not a PDF", () => {
		expect(pdfProblemOf(Buffer.from("Error during processing."), 1)).toBe("the output is not a PDF")
	})

	it("ADR-018 refuses a PDF cut short", () => {
		const whole = tesseractLikePdf(2)
		expect(pdfProblemOf(whole.subarray(0, whole.length - 10), 2)).toBe("the PDF is incomplete")
	})

	it("CAP-022-R05 refuses a PDF that lost a page", () => {
		expect(pdfProblemOf(tesseractLikePdf(1), 2)).toBe("the PDF holds 1 pages instead of 2")
	})

	it("CAP-022-R11 refuses a PDF without the font of the text layer", () => {
		const pdf = Buffer.from(tesseractLikePdf(1).toString("latin1").replace("/GlyphLessFont", "/Helvetica"), "latin1")
		expect(pdfProblemOf(pdf, 1)).toBe("the PDF has no text layer")
	})

	it("CAP-022-R11 refuses a page without the text layer", () => {
		expect(pdfProblemOf(tesseractLikePdf(2, { hasPageFonts: false }), 2)).toBe("a page of the PDF has no text layer")
	})
})
