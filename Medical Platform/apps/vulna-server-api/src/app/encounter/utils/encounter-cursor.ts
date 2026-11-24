import { z } from "zod"
import { isCursorMoment } from "../../infra/utils/cursor-moment"
import { decodePageCursor, encodePageCursor } from "../../infra/utils/page-cursor"
import type { EncounterCursor, PagedEncounterRow } from "../types/encounter.types"

const CURSOR_SEPARATOR = "|"
const SORT_KEY_PART_COUNT = 2
const calendarDateSchema = z.iso.date()

type SortKey = Omit<EncounterCursor, "id">

function sortKeyOf(sortKey: string): SortKey | undefined {
	const parts = sortKey.split(CURSOR_SEPARATOR)
	const [date, moment] = parts
	if (parts.length !== SORT_KEY_PART_COUNT || date === undefined || moment === undefined) {
		return undefined
	}
	const isWellFormed = calendarDateSchema.safeParse(date).success && isCursorMoment(moment)
	return isWellFormed ? { date, moment } : undefined
}

function isSortKey(sortKey: string): boolean {
	return sortKeyOf(sortKey) !== undefined
}

// CAP-014-R24, ADR-012
export function encodeEncounterCursor(row: PagedEncounterRow): string {
	return encodePageCursor({ sortKey: `${row.date}${CURSOR_SEPARATOR}${row.cursor_moment}`, id: row.id })
}

// CAP-014-R24, ADR-012
export function decodeEncounterCursor(cursor: string | undefined): EncounterCursor | undefined {
	const decoded = decodePageCursor(cursor, isSortKey)
	if (decoded === undefined) {
		return undefined
	}
	const sortKey = sortKeyOf(decoded.sortKey)
	if (sortKey === undefined) {
		throw new Error(`the visit cursor ${decoded.id} lost its sort key`)
	}
	return { ...sortKey, id: decoded.id }
}
