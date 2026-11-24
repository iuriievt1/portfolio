import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { encodePageCursor } from "../../infra/utils/page-cursor"
import { decodeEncounterCursor, encodeEncounterCursor } from "../utils/encounter-cursor"
import { ENCOUNTER, encounterRow, TODAY } from "./encounter-fixtures"

const MOMENT = "2026-10-07T08:00:00.000000Z"

function statusOf(cursor: string): number {
	try {
		decodeEncounterCursor(cursor)
	} catch (error) {
		if (error instanceof ProblemException) {
			return error.getStatus()
		}
		throw error
	}
	throw new Error("the cursor was accepted")
}

describe("cursor of the visits of a patient CAP-014-R24", () => {
	it("reads back the day, the moment and the visit it was made from", () => {
		const cursor = encodeEncounterCursor({ ...encounterRow(), cursor_moment: MOMENT })

		expect(decodeEncounterCursor(cursor)).toEqual({ date: TODAY, moment: MOMENT, id: ENCOUNTER })
	})

	it.each([
		["without the day", MOMENT],
		["with a day that does not exist", `2026-02-30|${MOMENT}`],
		["with a broken moment", `${TODAY}|yesterday`],
		["with one part too many", `${TODAY}|${MOMENT}|${MOMENT}`],
	])("ADR-012 refuses a sort key %s as a bad request", (_name, sortKey) => {
		expect(statusOf(encodePageCursor({ sortKey, id: ENCOUNTER }))).toBe(HttpStatus.BAD_REQUEST)
	})
})
