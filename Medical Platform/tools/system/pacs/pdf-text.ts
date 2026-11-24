import { inflateSync } from "node:zlib"

// ADR-018, apps/vulna-server-worker/src/app/text-recognition/__tests__/tesseract.ocr.test.ts
const FLATE_STREAM = /\/Length (\d+) \/Filter \/FlateDecode\s*>>\s*stream\r?\n/g
const PAGE_CONTENT = /\/Im1 Do/
const TEXT_STRING = /<([0-9A-F]+)>/g
const HAS_TEXT_STRING = /<[0-9A-F]+>/
const TITLE_ENTRY = /\/Title <FEFF([0-9A-F]*)>/
const INVISIBLE_TEXT = /\b3 Tr\b/
const LATIN1 = "latin1"
const HEX = "hex"
const SPACE = " "

function utf16Of(hex: string): string {
	return Buffer.from(hex, HEX).swap16().toString("utf16le")
}

function pageContentsOf(pdf: Buffer): string[] {
	const text = pdf.toString(LATIN1)
	return [...text.matchAll(FLATE_STREAM)]
		.map((match) => {
			const start = (match.index ?? 0) + match[0].length
			return inflateSync(pdf.subarray(start, start + Number(match[1]))).toString(LATIN1)
		})
		.filter((content) => PAGE_CONTENT.test(content))
}

// CAP-022-R05, CAP-022-R09
export function pageTextsOf(pdf: Buffer): string[] {
	return pageContentsOf(pdf).map((content) =>
		[...content.matchAll(TEXT_STRING)].map((string) => utf16Of(string[1] ?? "")).join(""),
	)
}

// ISO 32000-1 9.3.6, CAP-022-R05
export function isTextLayerInvisible(pdf: Buffer): boolean {
	const withText = pageContentsOf(pdf).filter((content) => HAS_TEXT_STRING.test(content))
	return withText.length > 0 && withText.every((content) => INVISIBLE_TEXT.test(content))
}

// CAP-022-R16
export function titleOf(pdf: Buffer): string | undefined {
	const hex = TITLE_ENTRY.exec(pdf.toString(LATIN1))?.[1]
	return hex === undefined ? undefined : utf16Of(hex)
}

export function withoutSpaces(text: string): string {
	return text.replaceAll(SPACE, "")
}
