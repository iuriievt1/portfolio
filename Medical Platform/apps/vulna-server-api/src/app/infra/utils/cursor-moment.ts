import type postgres from "@veevoy/postgres"
import { z } from "zod"
import type { Executor } from "../../../libs/database/database.service"
import { decodePageCursor, encodePageCursor, type PageCursor } from "./page-cursor"

// microsecond precision
const CURSOR_MOMENT_FORMAT = 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
const cursorMomentSchema = z.iso.datetime()

type Fragment = postgres.PendingQuery<postgres.Row[]>

export function cursorMomentOf(sql: Executor, moment: Fragment): Fragment {
	return sql`to_char(${moment} AT TIME ZONE 'UTC', ${CURSOR_MOMENT_FORMAT})`
}

export function isCursorMoment(sortKey: string): boolean {
	return cursorMomentSchema.safeParse(sortKey).success
}

// ADR-012
export function decodeMomentCursor(cursor: string | undefined): PageCursor | undefined {
	return decodePageCursor(cursor, isCursorMoment)
}

// ADR-012
export function olderThan(sql: Executor, keys: Fragment, cursor: PageCursor | undefined): Fragment {
	return cursor === undefined ? sql`TRUE` : sql`(${keys}) < (${cursor.sortKey}::text::timestamptz, ${cursor.id}::uuid)`
}

// ADR-012
export function newerThan(sql: Executor, keys: Fragment, cursor: PageCursor | undefined): Fragment {
	return cursor === undefined ? sql`TRUE` : sql`(${keys}) > (${cursor.sortKey}::text::timestamptz, ${cursor.id}::uuid)`
}

export interface MomentPage<Row> {
	rows: Row[]
	nextCursor: string | null
}

// ADR-012
export function momentPageOf<Row extends { id: string }>(
	rows: readonly Row[],
	limit: number,
	momentOf: (row: Row) => string,
): MomentPage<Row> {
	const page = rows.slice(0, limit)
	const last = page.at(-1)
	const hasMore = rows.length > limit && last !== undefined
	return { rows: page, nextCursor: hasMore ? encodePageCursor({ sortKey: momentOf(last), id: last.id }) : null }
}
