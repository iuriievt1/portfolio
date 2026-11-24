import { CODE_LIST_ITEM_NAME_MAX_LENGTH, CODE_LIST_TRANSLATION_IMPORT_MAX_ITEMS } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import cs from "@/i18n/cs.json"
import { fillText, formatCount } from "@/lib/format"
import { fileLineOf, fileRowsOf, importRowsOf, translationRowsOf } from "../lib/translation-csv"

const texts = cs.codeLists.import
const CODE_LIST_CODES = ["wound-type", "healing-phase", "document-title"]
const BYTE_ORDER_MARK = "\uFEFF"
const WINDOWS_1250_C_CARON = 0xe8
const LINE_FEED = 0x0a

function rowsOf(text: string) {
	return translationRowsOf(text, CODE_LIST_CODES)
}

describe("translation file", () => {
	it("reads rows separated by semicolons, skips the header and keeps the line of each row", () => {
		expect(
			rowsOf('code_list_code;code;name\nwound-type;leg-ulcer;"Ulcus cruris; venös"\n\nwound-type;burn;Verbrennung\n'),
		).toEqual({
			ok: true,
			rows: [
				{ code_list_code: "wound-type", code: "leg-ulcer", name: "Ulcus cruris; venös" },
				{ code_list_code: "wound-type", code: "burn", name: "Verbrennung" },
			],
			lineNumbers: [2, 4],
			headerLineNumber: 1,
		})
	})

	it("reads comma separated rows with doubled quotes and no header", () => {
		expect(rowsOf('healing-phase,sloughy,"Belegt ""fibrinös"""')).toEqual({
			ok: true,
			rows: [{ code_list_code: "healing-phase", code: "sloughy", name: 'Belegt "fibrinös"' }],
			lineNumbers: [1],
			headerLineNumber: undefined,
		})
	})

	it("takes a Czech header for a header", () => {
		const parsed = rowsOf("kód číselníku;kód položky;název\nwound-type;burn;Verbrennung")

		expect(parsed).toMatchObject({ ok: true, lineNumbers: [2], headerLineNumber: 1 })
	})

	it("reads an Excel export with a byte order mark and Windows line ends", () => {
		const parsed = rowsOf(`${BYTE_ORDER_MARK}wound-type;burn;Verbrennung\r\nwound-type;leg-ulcer;Ulcus cruris\r\n`)

		expect(parsed).toEqual({
			ok: true,
			rows: [
				{ code_list_code: "wound-type", code: "burn", name: "Verbrennung" },
				{ code_list_code: "wound-type", code: "leg-ulcer", name: "Ulcus cruris" },
			],
			lineNumbers: [1, 2],
			headerLineNumber: undefined,
		})
	})

	it("reads tab separated rows", () => {
		expect(rowsOf("wound-type\tburn\tVerbrennung, Grad 2")).toMatchObject({
			ok: true,
			rows: [{ code_list_code: "wound-type", code: "burn", name: "Verbrennung, Grad 2" }],
		})
	})

	it("skips rows Excel leaves with separators only", () => {
		expect(rowsOf(";;\nwound-type;burn;Verbrennung\n;;\n ; ; \n")).toMatchObject({ ok: true, lineNumbers: [2] })
	})

	it("picks the separator that gives three columns when the name holds another one", () => {
		expect(rowsOf('wound-type,burn,"Verbrennung; Grad 2"')).toMatchObject({
			ok: true,
			rows: [{ code_list_code: "wound-type", code: "burn", name: "Verbrennung; Grad 2" }],
		})
	})

	it("names the line that does not have three columns", () => {
		expect(rowsOf("wound-type;burn;Verbrennung\nwound-type;burn")).toEqual({ ok: false, lineNumber: 2 })
	})
})

describe("rows sent to the import CAP-017-R18", () => {
	it("names the file line of a row without a name", () => {
		expect(importRowsOf(rowsOf("code_list_code;code;name\n\nwound-type;burn;"))).toEqual({
			ok: false,
			error: fillText(texts.rejectedRow, { row: "3", reason: texts.rejection["name-missing"] }),
		})
	})

	it("names the file line of a name longer than the server takes", () => {
		const name = "x".repeat(CODE_LIST_ITEM_NAME_MAX_LENGTH + 1)

		expect(importRowsOf(rowsOf(`wound-type;burn;Verbrennung\nwound-type;leg-ulcer;${name}`))).toEqual({
			ok: false,
			error: fillText(texts.errors.nameTooLong, { row: "2", max: formatCount(CODE_LIST_ITEM_NAME_MAX_LENGTH) }),
		})
	})

	it("refuses more rows than the server takes and names the first extra line", () => {
		const header = "code_list_code;code;name"
		const lines = Array.from(
			{ length: CODE_LIST_TRANSLATION_IMPORT_MAX_ITEMS + 1 },
			(_, index) => `wound-type;item-${index};Name`,
		)

		expect(importRowsOf(rowsOf([header, ...lines].join("\n")))).toEqual({
			ok: false,
			error: fillText(texts.errors.tooManyRows, {
				max: formatCount(CODE_LIST_TRANSLATION_IMPORT_MAX_ITEMS),
				row: String(CODE_LIST_TRANSLATION_IMPORT_MAX_ITEMS + 2),
			}),
		})
	})

	it("refuses a file with a header only", () => {
		expect(importRowsOf(rowsOf("code_list_code;code;name\n"))).toEqual({ ok: false, error: texts.errors.fileEmpty })
	})

	it("refuses a file that is not UTF-8", () => {
		const windows1250 = new Uint8Array([WINDOWS_1250_C_CARON, LINE_FEED]).buffer

		expect(fileRowsOf(windows1250, CODE_LIST_CODES)).toEqual({ ok: false, error: texts.errors.encoding })
	})

	it("maps rows the server rejected to the lines of the file", () => {
		const rows = fileRowsOf(
			new TextEncoder().encode("code_list_code;code;name\nwound-type;burn;Verbrennung\n;;\nwound-type;unknown;Neu")
				.buffer,
			CODE_LIST_CODES,
		)

		expect(fileLineOf(rows, 1)).toBe(2)
		expect(fileLineOf(rows, 2)).toBe(4)
	})
})
