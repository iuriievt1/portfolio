import { ADMINISTERED_ACQUISITION_STATE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import {
	acquisitionFilterOf,
	acquisitionQueryOf,
	EMPTY_ACQUISITION_FILTER,
	filterOfValues,
	isFiltered,
	searchParamsOf,
} from "@/features/acquisitions/lib/acquisition-filter"
import { acquisitionFilterSchema } from "@/features/acquisitions/lib/acquisition-filter.schema"
import type { AcquisitionFilter } from "@/features/acquisitions/types/acquisition.types"
import { endOfDay, startOfDay } from "@/lib/calendar-date"

const BIRTH_NUMBER = "800101/1234"

const FILTER: AcquisitionFilter = {
	state: ADMINISTERED_ACQUISITION_STATE.FAILED,
	fromDate: "2026-10-01",
	toDate: "2026-10-31",
	patientIdentifier: BIRTH_NUMBER,
}

describe("acquisition search in the administration CAP-004-R10", () => {
	it("DESIGN.md 9.1 keeps the state and the period in the address but never the patient identifier", () => {
		const params = new URLSearchParams(searchParamsOf(FILTER))

		expect(params.toString()).not.toContain("800101")
		expect(acquisitionFilterOf(params, undefined)).toEqual({ ...FILTER, patientIdentifier: undefined })
	})

	it("ignores a state and a date from the address that it does not know", () => {
		const params = new URLSearchParams({ state: "lost", from: "2026-02-30" })

		expect(acquisitionFilterOf(params, undefined)).toEqual(EMPTY_ACQUISITION_FILTER)
		expect(isFiltered(EMPTY_ACQUISITION_FILTER)).toBe(false)
	})

	it("asks for whole days from the start of the first to the end of the last", () => {
		expect(acquisitionQueryOf(FILTER)).toEqual({
			state: ADMINISTERED_ACQUISITION_STATE.FAILED,
			patient_identifier: BIRTH_NUMBER,
			from: startOfDay("2026-10-01"),
			to: endOfDay("2026-10-31"),
		})
	})

	it("reads the form without blanks and leaves out empty fields", () => {
		const filter = filterOfValues({ patientIdentifier: `  ${BIRTH_NUMBER} `, state: "", fromDate: "", toDate: "" })

		expect(filter).toEqual({ ...EMPTY_ACQUISITION_FILTER, patientIdentifier: BIRTH_NUMBER })
	})

	it("refuses a period that ends before it starts", () => {
		const parsed = acquisitionFilterSchema.safeParse({
			patientIdentifier: "",
			state: "",
			fromDate: "2026-10-31",
			toDate: "2026-10-01",
		})

		expect(parsed.success).toBe(false)
	})
})
