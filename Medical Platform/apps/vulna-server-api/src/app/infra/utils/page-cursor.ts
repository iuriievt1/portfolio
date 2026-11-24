import { ERROR_CODE } from "@ansora/contracts"
import { HttpStatus } from "@nestjs/common"
import { z } from "zod"
import { ProblemException } from "../exceptions/problem.exception"

const CURSOR_KEY_COUNT = 2
const INVALID_CURSOR_DETAIL = "cursor: not a cursor this listing issued"
const cursorIdSchema = z.uuid()

export interface PageCursor {
	sortKey: string
	id: string
}

type SortKeyCheck = (sortKey: string) => boolean

function isAnySortKey(): boolean {
	return true
}

// index.yaml Cursor, Error400
function invalidCursor(): ProblemException {
	return new ProblemException(HttpStatus.BAD_REQUEST, ERROR_CODE.RECORD_REJECTED, INVALID_CURSOR_DETAIL)
}

function keysOf(cursor: string): unknown {
	try {
		return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
	} catch {
		throw invalidCursor()
	}
}

export function encodePageCursor(cursor: PageCursor): string {
	return Buffer.from(JSON.stringify([cursor.sortKey, cursor.id])).toString("base64url")
}

// ADR-012
export function decodePageCursor(
	cursor: string | undefined,
	isSortKey: SortKeyCheck = isAnySortKey,
): PageCursor | undefined {
	if (cursor === undefined) {
		return undefined
	}
	const keys = keysOf(cursor)
	if (!Array.isArray(keys) || keys.length !== CURSOR_KEY_COUNT) {
		throw invalidCursor()
	}
	const [sortKey, id] = keys
	if (typeof sortKey !== "string" || !isSortKey(sortKey) || !cursorIdSchema.safeParse(id).success) {
		throw invalidCursor()
	}
	return { sortKey, id }
}
