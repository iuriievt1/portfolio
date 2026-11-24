import { ERROR_CODE } from "@ansora/contracts"
import { HttpStatus } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import { ProblemException } from "../../exceptions/problem.exception"
import { decodeMomentCursor, isCursorMoment, momentPageOf, newerThan, olderThan } from "../cursor-moment"
import { decodePageCursor, encodePageCursor } from "../page-cursor"

const ID = "8c0d4a52-6a43-4f55-9a43-3c2f8d5c1e10"
const MOMENT = "2026-09-12T07:10:00.123456Z"

function encoded(keys: unknown): string {
	return Buffer.from(JSON.stringify(keys)).toString("base64url")
}

function problemOf(decode: () => unknown): ProblemException {
	try {
		decode()
	} catch (error) {
		if (error instanceof ProblemException) {
			return error
		}
		throw error
	}
	throw new Error("the cursor was accepted")
}

describe("page cursor ADR-012", () => {
	it("returns the keys it was made from, separators included", () => {
		const cursor = { sortKey: "Nováková | Jana", id: ID }

		expect(decodePageCursor(encodePageCursor(cursor))).toEqual(cursor)
	})

	it("reads a missing cursor as the first page", () => {
		expect(decodePageCursor(undefined)).toBeUndefined()
	})

	it.each([
		["not a cursor", "not-a-cursor"],
		["one key", encoded(["only"])],
		["keys that are not text", encoded([1, 2])],
		["an id that is not a UUID", encoded([MOMENT, "not-a-uuid"])],
	])("refuses %s as a bad request the client does not repeat", (_name, cursor) => {
		const problem = problemOf(() => decodePageCursor(cursor))

		expect(problem.getStatus()).toBe(HttpStatus.BAD_REQUEST)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})
})

describe("moment cursor ADR-012", () => {
	it("reads back a cursor of a moment with microseconds", () => {
		expect(decodeMomentCursor(encodePageCursor({ sortKey: MOMENT, id: ID }))).toEqual({ sortKey: MOMENT, id: ID })
	})

	it.each([
		["text", "Nováková"],
		["a day that does not exist", "2026-02-30T07:10:00.000000Z"],
		["a moment with an offset", "2026-09-12T09:10:00+02:00"],
	])("refuses a sort key that is %s", (_name, sortKey) => {
		expect(isCursorMoment(sortKey)).toBe(false)
		expect(problemOf(() => decodeMomentCursor(encodePageCursor({ sortKey, id: ID }))).getStatus()).toBe(
			HttpStatus.BAD_REQUEST,
		)
	})
})

interface CapturedQuery {
	text: string
	values: unknown[]
}

const capture = ((strings: TemplateStringsArray, ...values: unknown[]): CapturedQuery => ({
	text: strings.join("$"),
	values,
})) as unknown as postgres.Sql

describe("moment cursor in a query ADR-012", () => {
	it.each([
		["older", olderThan],
		["newer", newerThan],
	])("hands the %s moment to the database as text so its microseconds survive", (_name, condition) => {
		const query = condition(capture, capture`created_at, id`, { sortKey: MOMENT, id: ID }) as unknown as CapturedQuery

		expect(query.text).toContain("::text::timestamptz")
		expect(query.values).toContain(MOMENT)
	})
})

describe("page of moment rows ADR-012", () => {
	const rows = [
		{ id: ID, moment: MOMENT },
		{ id: "9d1e5b63-7b54-4066-8b54-4d3f9e6d2f21", moment: MOMENT },
	]

	it("hands the cursor of the last shown row when the database returned one more", () => {
		const page = momentPageOf(rows, 1, (row) => row.moment)

		expect(page.rows).toEqual([rows[0]])
		expect(page.nextCursor).toBe(encodePageCursor({ sortKey: MOMENT, id: ID }))
	})

	it("ends the listing when every row fits", () => {
		expect(momentPageOf(rows, 2, (row) => row.moment)).toEqual({ rows, nextCursor: null })
	})
})
