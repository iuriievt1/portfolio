import { ENCOUNTER_STATUS } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { Encounter } from "../../../api/encounters"
import cs from "../../../i18n/cs.json"
import { todayVisitsOf, todayVisitWhenOf, visitRecordsOf } from "../today-visits"

const BASE: Encounter = {
	encounter_id: "00000000-0000-4000-8000-000000000001",
	patient_id: "00000000-0000-4000-8000-000000000002",
	date: "2026-09-19",
	source: "worklist",
	status: ENCOUNTER_STATUS.PLANNED,
	acquisition_count: 0,
}

function visit(id: string, change: Partial<Encounter>): Encounter {
	return { ...BASE, encounter_id: id, ...change }
}

describe("todayVisitsOf", () => {
	it("CAP-014-R19 puts visits in progress first, the newest on top, then planned by time and no time last", () => {
		const plannedLate = visit("planned-late", { scheduled_time: "2026-09-19T09:15:00Z" })
		const plannedEarly = visit("planned-early", { scheduled_time: "2026-09-19T08:30:00Z" })
		const plannedUntimed = visit("planned-untimed", { scheduled_time: null })
		const startedEarly = visit("started-early", {
			status: ENCOUNTER_STATUS.IN_PROGRESS,
			source: "created_in_app",
			started_at: "2026-09-19T06:30:00Z",
		})
		const startedLate = visit("started-late", {
			status: ENCOUNTER_STATUS.IN_PROGRESS,
			source: "created_in_app",
			started_at: "2026-09-19T07:45:00Z",
		})
		const ordered = todayVisitsOf([plannedUntimed, plannedLate, startedEarly, plannedEarly, startedLate])
		expect(ordered.map((encounter) => encounter.encounter_id)).toEqual([
			"started-late",
			"started-early",
			"planned-early",
			"planned-late",
			"planned-untimed",
		])
	})

	it("CAP-014-R12 offers no finished visit among today's visits", () => {
		const finished = visit("finished", { status: ENCOUNTER_STATUS.COMPLETED })
		expect(todayVisitsOf([finished])).toEqual([])
	})
})

describe("todayVisitWhenOf", () => {
	it("CAP-014-R19 shows the time of the visit in Prague time", () => {
		expect(todayVisitWhenOf(visit("planned", { scheduled_time: "2026-09-19T08:30:00Z" }), cs)).toBe("Dnes 10:30")
	})

	it("CAP-014-S13 never makes up a time the work list does not carry", () => {
		expect(todayVisitWhenOf(visit("planned", { scheduled_time: null }), cs)).toBe("Dnes · čas neurčen")
	})
})

describe("visitRecordsOf", () => {
	it("CAP-014-S24 shows a visit where only a colleague works as one without records", () => {
		expect(
			visitRecordsOf(visit("in-progress", { status: ENCOUNTER_STATUS.IN_PROGRESS, acquisition_count: 0 }), cs),
		).toBe("bez záznamů")
	})

	it("CAP-015-R28 declines the count of records", () => {
		expect(visitRecordsOf(visit("in-progress", { acquisition_count: 3 }), cs)).toBe("3 záznamy")
		expect(visitRecordsOf(visit("in-progress", { acquisition_count: 5 }), cs)).toBe("5 záznamů")
	})
})

describe("visit counts and moments", () => {
	it("CAP-014-R19 never makes up a zero when the server sends no count", () => {
		const { acquisition_count: _, ...withoutCount } = BASE
		expect(visitRecordsOf(withoutCount, cs)).toBeUndefined()
	})

	it("CAP-014-S13 shows the planned time of a work list visit in progress without its own start", () => {
		const started = visit("started", {
			status: ENCOUNTER_STATUS.IN_PROGRESS,
			scheduled_time: "2026-09-19T08:30:00Z",
			started_at: null,
		})
		expect(todayVisitWhenOf(started, cs)).toBe("Dnes 10:30")
	})
})
