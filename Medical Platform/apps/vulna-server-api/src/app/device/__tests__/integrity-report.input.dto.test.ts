import { describe, expect, it } from "vitest"
import { integrityReportSchema } from "../dto/integrity-report.input.dto"

const REPORT = {
	signals: ["magisk"],
	detected_at: "2026-10-29T08:00:00.000Z",
	unsent_items: { count: 0, oldest_acquired_at: null },
}

describe("report of a modified operating system", () => {
	it("CAP-008-R11 accepts the closed report", () => {
		expect(integrityReportSchema.safeParse(REPORT).success).toBe(true)
	})

	it("CAP-008-S08 refuses anything the report does not carry", () => {
		expect(integrityReportSchema.safeParse({ ...REPORT, details: "Magisk 27.0, Shamiko" }).success).toBe(false)
		const withApps = { ...REPORT, unsent_items: { ...REPORT.unsent_items, apps: ["com.topjohnwu.magisk"] } }
		expect(integrityReportSchema.safeParse(withApps).success).toBe(false)
	})

	it("refuses an unknown, a repeated and a missing signal", () => {
		expect(integrityReportSchema.safeParse({ ...REPORT, signals: ["xposed"] }).success).toBe(false)
		expect(integrityReportSchema.safeParse({ ...REPORT, signals: ["root", "root"] }).success).toBe(false)
		expect(integrityReportSchema.safeParse({ ...REPORT, signals: [] }).success).toBe(false)
	})

	it("refuses a negative count and a moment without an offset", () => {
		const negative = { ...REPORT, unsent_items: { count: -1, oldest_acquired_at: null } }
		expect(integrityReportSchema.safeParse(negative).success).toBe(false)
		expect(integrityReportSchema.safeParse({ ...REPORT, detected_at: "2026-10-29T08:00:00" }).success).toBe(false)
	})
})
