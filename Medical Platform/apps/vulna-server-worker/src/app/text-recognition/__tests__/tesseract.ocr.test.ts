import { readFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { inflateSync } from "node:zlib"
import { beforeAll, describe, expect, it } from "vitest"
import { SANDBOX_PATH, TESSDATA_PATH, TESSERACT_PATH } from "../constants/text-recognition.constants"
import { TesseractService } from "../services/tesseract.service"
import { pdfProblemOf } from "../utils/pdf-output"

// Q-040, ADR-024
const SCAN_DIRECTORY = resolve(__dirname, "../../../../../../quality/data/synteticka-sada/scan")
const CZECH_PAGE = resolve(SCAN_DIRECTORY, "page-cs.jpg")
const ENGLISH_PAGE = resolve(SCAN_DIRECTORY, "page-en.jpg")
const BLANK_PAGE = resolve(SCAN_DIRECTORY, "page-blank.jpg")
const PAGES = [CZECH_PAGE, ENGLISH_PAGE, BLANK_PAGE]
const PAGE_SCANNED_BY_THE_PHONE = resolve(SCAN_DIRECTORY, "ladder/page-cs-light.jpg")
const CZECH_HEADING = "Syntetický dokument pro test rozpoznání textu"
const CZECH_PANGRAM = "Příliš žluťoučký kůň úpěl ďábelské ódy."
const ONE_PAGE = 1
const TITLE = "Propouštěcí zpráva"
const TIMEOUT_MILLISECONDS = 120_000
const MEMORY_LIMIT_BYTES = 1024 * 1024 * 1024
const FLATE_STREAM = /\/Length (\d+) \/Filter \/FlateDecode\s*>>\s*stream\r?\n/g
const PAGE_CONTENT = /\/Im1 Do/
const TEXT_STRING = /<([0-9A-F]+)>/g
const TITLE_ENTRY = /\/Title <FEFF([0-9A-F]*)>/

function utf16Of(hex: string): string {
	return Buffer.from(hex, "hex").swap16().toString("utf16le")
}

function pageTextsOf(pdf: Buffer): string[] {
	const text = pdf.toString("latin1")
	return [...text.matchAll(FLATE_STREAM)]
		.map((match) => {
			const start = (match.index ?? 0) + match[0].length
			return inflateSync(pdf.subarray(start, start + Number(match[1]))).toString("latin1")
		})
		.filter((content) => PAGE_CONTENT.test(content))
		.map((content) => [...content.matchAll(TEXT_STRING)].map((string) => utf16Of(string[1] ?? "")).join(""))
}

function withoutSpaces(text: string | undefined): string {
	return (text ?? "").replaceAll(" ", "")
}

const SETTINGS = {
	sandboxPath: SANDBOX_PATH,
	tesseractPath: TESSERACT_PATH,
	tessdataPath: TESSDATA_PATH,
	timeoutMilliseconds: TIMEOUT_MILLISECONDS,
	memoryLimitBytes: MEMORY_LIMIT_BYTES,
}

function titleOf(pdf: Buffer): string | undefined {
	const hex = TITLE_ENTRY.exec(pdf.toString("latin1"))?.[1]
	return hex === undefined ? undefined : utf16Of(hex)
}

describe("TesseractService with tesseract and the sandbox from the image", () => {
	let pdf: Buffer

	beforeAll(async () => {
		pdf = await new TesseractService().pdfOf(
			PAGES.map((path) => () => readFile(path)),
			TITLE,
			SETTINGS,
		)
	})

	it("CAP-022-R05 makes one searchable PDF over all pages, CAP-022-R03 recognizing Czech and English", () => {
		expect(pdfProblemOf(pdf, PAGES.length)).toBeUndefined()
		const [czech, english] = pageTextsOf(pdf)
		expect(withoutSpaces(czech)).toContain(withoutSpaces(CZECH_PANGRAM))
		expect(withoutSpaces(english)).toContain("brownfoxjumpsoverthelazydog.")
	})

	it("CAP-022-S02 gives a blank page an empty text layer and keeps the document", () => {
		const texts = pageTextsOf(pdf)

		expect(texts).toHaveLength(PAGES.length)
		expect(texts[2]).toBe("")
	})

	it("CAP-022-R05 puts every scanned page into the PDF without encoding it again", () => {
		for (const path of PAGES) {
			expect(pdf.indexOf(readFileSync(path))).toBeGreaterThan(0)
		}
	})

	it("CAP-022-R16 names the PDF by the title it was given and by nothing else", () => {
		expect(titleOf(pdf)).toBe(TITLE)
		expect(pdf.toString("latin1")).not.toMatch(/\/(Author|Subject|Keywords) /)
	})
})

// Q-040, ADR-024, quality/data/synteticka-sada/README.md
describe("TesseractService on a page scanned by the app on the phone", () => {
	let pdf: Buffer

	beforeAll(async () => {
		pdf = await new TesseractService().pdfOf([() => readFile(PAGE_SCANNED_BY_THE_PHONE)], TITLE, SETTINGS)
	})

	it("CAP-022-S01 makes the page scanned by the phone a searchable PDF with its Czech text", () => {
		const [text] = pageTextsOf(pdf)

		expect(pdfProblemOf(pdf, ONE_PAGE)).toBeUndefined()
		expect(withoutSpaces(text)).toContain(withoutSpaces(CZECH_HEADING))
		expect(withoutSpaces(text)).toContain(withoutSpaces(CZECH_PANGRAM))
	})

	it("CAP-022-R05 puts the page scanned by the phone into the PDF without encoding it again", () => {
		expect(pdf.indexOf(readFileSync(PAGE_SCANNED_BY_THE_PHONE))).toBeGreaterThan(0)
	})
})
