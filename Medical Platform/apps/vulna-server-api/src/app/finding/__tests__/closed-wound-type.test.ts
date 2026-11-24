import { describe, expect, it } from "vitest"
import { closedWoundTypeOf, historyWoundTypeOf } from "../utils/closed-wound-type"
import { findingRow, NEXT_SET_VERSION, SET_VERSION, timelineRow } from "./finding-fixtures"

describe("wound type a record closed with CAP-020-R19", () => {
	it("CAP-020-S25 keeps the type copied at closing although the finding changed it later", () => {
		const record = timelineRow({
			closed_wound_type_code: "traumatic-wound",
			closed_wound_type_code_list_version: SET_VERSION,
		})

		expect(closedWoundTypeOf(record)).toEqual({ code: "traumatic-wound", codeListVersion: SET_VERSION })
		expect(historyWoundTypeOf(findingRow(), "leg-ulcer")).toEqual({
			code: "leg-ulcer",
			codeListVersion: NEXT_SET_VERSION,
		})
	})

	it("CAP-020-S12 gives a scanned document no wound type", () => {
		const document = timelineRow({
			kind: "scan",
			closed_wound_type_code: null,
			closed_wound_type_code_list_version: null,
		})

		expect(closedWoundTypeOf(document)).toEqual({ code: null, codeListVersion: null })
	})
})
