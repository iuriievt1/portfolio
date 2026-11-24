import { CODE_LIST_ITEM_NAME_MAX_LENGTH, CODE_LIST_TRANSLATION_IMPORT_MAX_ITEMS } from "@ansora/contracts"
import type { TranslationRow } from "@/features/code-lists/types/code-list.types"
import cs from "@/i18n/cs.json"
import { fillText, formatCount } from "@/lib/format"

const texts = cs.codeLists.import

const COLUMNS = 3
const SEPARATORS = [";", ",", "\t"] as const
const QUOTE = '"'
const LINE_BREAK = /\r?\n/
const BYTE_ORDER_MARK = /^\uFEFF/
const ENCODING = "utf-8"
const FIRST_ROW = 1

interface TranslationLines {
	rows: TranslationRow[]
	lineNumbers: number[]
	headerLineNumber: number | undefined
}

export type CsvParse = ({ ok: true } & TranslationLines) | { ok: false; lineNumber: number }

export type ImportRows = ({ ok: true } & TranslationLines) | { ok: false; error: string }

interface FileLine {
	fields: string[]
	lineNumber: number
}

function utf8TextOf(bytes: ArrayBuffer): string | undefined {
	try {
		return new TextDecoder(ENCODING, { fatal: true }).decode(bytes)
	} catch {
		return undefined
	}
}

function fieldsOf(line: string, separator: string): string[] {
	const fields: string[] = []
	let field = ""
	let quoted = false
	for (let index = 0; index < line.length; index += 1) {
		const character = line.charAt(index)
		if (quoted) {
			if (character === QUOTE && line.charAt(index + 1) === QUOTE) {
				field += QUOTE
				index += 1
			} else if (character === QUOTE) {
				quoted = false
			} else {
				field += character
			}
		} else if (character === QUOTE) {
			quoted = true
		} else if (character === separator) {
			fields.push(field)
			field = ""
		} else {
			field += character
		}
	}
	fields.push(field)
	return fields
}

function isBlank(fields: readonly string[]): boolean {
	return fields.every((field) => field.trim() === "")
}

function isBlankLine(line: string): boolean {
	return SEPARATORS.some((candidate) => isBlank(fieldsOf(line, candidate)))
}

function separatorOf(line: string): string {
	return SEPARATORS.find((candidate) => fieldsOf(line, candidate).length === COLUMNS) ?? SEPARATORS[0]
}

function isHeader(line: FileLine, codeListCodes: readonly string[]): boolean {
	return !codeListCodes.includes((line.fields[0] ?? "").trim())
}

// CAP-017-R18, administration.yaml importCodeListTranslations
export function translationRowsOf(text: string, codeListCodes: readonly string[]): CsvParse {
	const lines = text.replace(BYTE_ORDER_MARK, "").split(LINE_BREAK)
	const firstFilled = lines.find((line) => !isBlankLine(line))
	if (firstFilled === undefined) {
		return { ok: true, rows: [], lineNumbers: [], headerLineNumber: undefined }
	}
	const separator = separatorOf(firstFilled)
	const filled: FileLine[] = lines
		.map((line, index) => ({ fields: fieldsOf(line, separator), lineNumber: index + FIRST_ROW }))
		.filter(({ fields }) => !isBlank(fields))
	const [first] = filled
	const header = first !== undefined && isHeader(first, codeListCodes) ? first : undefined
	const rows: TranslationRow[] = []
	const lineNumbers: number[] = []
	for (const line of filled) {
		if (line === header) {
			continue
		}
		if (line.fields.length !== COLUMNS) {
			return { ok: false, lineNumber: line.lineNumber }
		}
		const [codeListCode = "", code = "", name = ""] = line.fields
		rows.push({ code_list_code: codeListCode.trim(), code: code.trim(), name: name.trim() })
		lineNumbers.push(line.lineNumber)
	}
	return { ok: true, rows, lineNumbers, headerLineNumber: header?.lineNumber }
}

function rowError(rows: readonly TranslationRow[], lineNumbers: readonly number[]): string | undefined {
	for (const [index, row] of rows.entries()) {
		const lineNumber = String(lineNumbers[index] ?? index + FIRST_ROW)
		if (row.name === "") {
			return fillText(texts.rejectedRow, { row: lineNumber, reason: texts.rejection["name-missing"] })
		}
		if (row.name.length > CODE_LIST_ITEM_NAME_MAX_LENGTH) {
			return fillText(texts.errors.nameTooLong, { row: lineNumber, max: formatCount(CODE_LIST_ITEM_NAME_MAX_LENGTH) })
		}
	}
	return undefined
}

// CAP-017-R18, CAP-017-S09
export function importRowsOf(parsed: CsvParse): ImportRows {
	if (!parsed.ok) {
		return { ok: false, error: fillText(texts.errors.fileColumns, { row: String(parsed.lineNumber) }) }
	}
	if (parsed.rows.length === 0) {
		return { ok: false, error: texts.errors.fileEmpty }
	}
	if (parsed.rows.length > CODE_LIST_TRANSLATION_IMPORT_MAX_ITEMS) {
		return {
			ok: false,
			error: fillText(texts.errors.tooManyRows, {
				max: formatCount(CODE_LIST_TRANSLATION_IMPORT_MAX_ITEMS),
				row: String(parsed.lineNumbers[CODE_LIST_TRANSLATION_IMPORT_MAX_ITEMS]),
			}),
		}
	}
	const error = rowError(parsed.rows, parsed.lineNumbers)
	return error === undefined ? parsed : { ok: false, error }
}

// administration.yaml Error.rejected_rows
export function fileLineOf(rows: ImportRows | undefined, row: number): number {
	return rows?.ok === true ? (rows.lineNumbers[row - FIRST_ROW] ?? row) : row
}

// CAP-017-R18
export function fileRowsOf(bytes: ArrayBuffer, codeListCodes: readonly string[]): ImportRows {
	const text = utf8TextOf(bytes)
	if (text === undefined) {
		return { ok: false, error: texts.errors.encoding }
	}
	return importRowsOf(translationRowsOf(text, codeListCodes))
}
