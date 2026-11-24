const PDF_HEADER = "%PDF-"
const PDF_TRAILER = "%%EOF"
const PAGE_OBJECT = /\/Type\s*\/Page(?![A-Za-z])[\s\S]*?endobj/g
const FONT_RESOURCE = "/Font"
const TEXT_LAYER_FONT = /\/BaseFont\s*\/GlyphLessFont\b/

// CAP-022-R05, CAP-022-R09, CAP-022-R11, ADR-018
export function pdfProblemOf(pdf: Buffer, pageCount: number): string | undefined {
	const text = pdf.toString("latin1")
	if (!text.startsWith(PDF_HEADER)) {
		return "the output is not a PDF"
	}
	if (!text.trimEnd().endsWith(PDF_TRAILER)) {
		return "the PDF is incomplete"
	}
	const pages = text.match(PAGE_OBJECT) ?? []
	if (pages.length !== pageCount) {
		return `the PDF holds ${pages.length} pages instead of ${pageCount}`
	}
	if (!TEXT_LAYER_FONT.test(text)) {
		return "the PDF has no text layer"
	}
	if (pages.some((page) => !page.includes(FONT_RESOURCE))) {
		return "a page of the PDF has no text layer"
	}
	return undefined
}
