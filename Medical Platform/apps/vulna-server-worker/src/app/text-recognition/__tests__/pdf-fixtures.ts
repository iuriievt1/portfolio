// CAP-022-R05
export function tesseractLikePdf(pageCount: number, options: { hasPageFonts?: boolean } = {}): Buffer {
	const font = options.hasPageFonts === false ? "" : " /Font << /f-0-0 3 0 R >>"
	const pages = Array.from(
		{ length: pageCount },
		(_, index) => `${10 + index} 0 obj\n<<\n  /Type /Page\n  /Resources <<${font} >>\n>>\nendobj\n`,
	).join("")
	return Buffer.from(
		`%PDF-1.5\n1 0 obj\n<<\n  /Type /Pages\n>>\nendobj\n3 0 obj\n<<\n  /BaseFont /GlyphLessFont\n  /Type /Font\n>>\nendobj\n${pages}%%EOF\n`,
		"latin1",
	)
}
