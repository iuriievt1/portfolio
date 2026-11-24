import { ADMINISTERED_ACQUISITION_STATE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { acquisitionSearchSchema } from "../dto/acquisition-search.input.dto"

const PATIENT_IDENTIFIER_MAX_LENGTH = 200

describe("acquisition search query CAP-004-R10", () => {
	it("accepts a state, a trimmed patient identifier and a time range", () => {
		const parsed = acquisitionSearchSchema.parse({
			state: ADMINISTERED_ACQUISITION_STATE.FAILED,
			patient_identifier: "  800101/1234 ",
			from: "2026-10-01T00:00:00+02:00",
			to: "2026-10-31T23:59:59Z",
			limit: "20",
		})

		expect(parsed).toEqual({
			state: ADMINISTERED_ACQUISITION_STATE.FAILED,
			patient_identifier: "800101/1234",
			from: "2026-10-01T00:00:00+02:00",
			to: "2026-10-31T23:59:59Z",
			limit: 20,
		})
	})

	it("refuses an unknown state, an empty or overlong identifier, a time without zone and an unknown parameter", () => {
		expect(acquisitionSearchSchema.safeParse({ state: "lost" }).success).toBe(false)
		expect(acquisitionSearchSchema.safeParse({ patient_identifier: "   " }).success).toBe(false)
		expect(
			acquisitionSearchSchema.safeParse({ patient_identifier: "1".repeat(PATIENT_IDENTIFIER_MAX_LENGTH + 1) }).success,
		).toBe(false)
		expect(acquisitionSearchSchema.safeParse({ from: "2026-10-01" }).success).toBe(false)
		expect(acquisitionSearchSchema.safeParse({ device_id: "any" }).success).toBe(false)
	})
})
