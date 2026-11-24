import { nameIn } from "@ansora/contracts"

// administration.yaml CodeListTranslationImport
export interface TranslationRow {
	codeListCode: string
	code: string
	name: string
}

// administration.yaml Error.rejected_rows
export const TRANSLATION_ROW_REJECTION = {
	ITEM_UNKNOWN: "code-list-item-unknown",
	NAME_MISSING: "name-missing",
	DUPLICATE_ITEM: "duplicate-item",
} as const

export type TranslationRowRejection = (typeof TRANSLATION_ROW_REJECTION)[keyof typeof TRANSLATION_ROW_REJECTION]

export interface RejectedTranslationRow {
	row: number
	code: TranslationRowRejection
}

export type TranslationImport =
	| { ok: true; writes: TranslationRow[]; unchangedCount: number }
	| { ok: false; rejectedRows: RejectedTranslationRow[] }

export type KnownNames = ReadonlyMap<string, ReadonlyMap<string, Readonly<Record<string, string>>>>

const FIRST_ROW = 1

// CAP-017-R18, CAP-017-S09, administration.yaml importCodeListTranslations
export function importTranslations(
	known: KnownNames,
	language: string,
	rows: readonly TranslationRow[],
): TranslationImport {
	const seen = new Set<string>()
	const rejectedRows: RejectedTranslationRow[] = []
	const writes: TranslationRow[] = []
	let unchangedCount = 0
	rows.forEach((row, index) => {
		const rowNumber = index + FIRST_ROW
		const names = known.get(row.codeListCode)?.get(row.code)
		const key = `${row.codeListCode}\u0000${row.code}`
		const name = row.name.trim()
		if (names === undefined) {
			rejectedRows.push({ row: rowNumber, code: TRANSLATION_ROW_REJECTION.ITEM_UNKNOWN })
			return
		}
		if (seen.has(key)) {
			rejectedRows.push({ row: rowNumber, code: TRANSLATION_ROW_REJECTION.DUPLICATE_ITEM })
			return
		}
		seen.add(key)
		if (name === "") {
			rejectedRows.push({ row: rowNumber, code: TRANSLATION_ROW_REJECTION.NAME_MISSING })
			return
		}
		if (nameIn(names, language) === name) {
			unchangedCount += 1
			return
		}
		writes.push({ codeListCode: row.codeListCode, code: row.code, name })
	})
	if (rejectedRows.length > 0) {
		return { ok: false, rejectedRows }
	}
	return { ok: true, writes, unchangedCount }
}
