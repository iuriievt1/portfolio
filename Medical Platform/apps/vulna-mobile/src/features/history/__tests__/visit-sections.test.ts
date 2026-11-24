import { ENCOUNTER_STATUS } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { Encounter } from "../../../api/encounters"
import cs from "../../../i18n/cs.json"
import { PILL_TONE } from "../../../ui/pill-tone"
import { SECTION_ROW, sectionRowsOf, sectionsInOrder } from "../sections"
import { VISIT_SECTION, visitRowOf, visitSectionsOf, visitSectionTitleOf } from "../visit-sections"

const TODAY = "2026-09-19"

const BASE: Encounter = {
	encounter_id: "base",
	patient_id: "00000000-0000-4000-8000-000000000002",
	date: TODAY,
	source: "worklist",
	status: ENCOUNTER_STATUS.COMPLETED,
	acquisition_count: 2,
}

function visit(id: string, change: Partial<Encounter>): Encounter {
	return { ...BASE, encounter_id: id, ...change }
}

const PLANNED_TODAY = visit("planned-today", {
	status: ENCOUNTER_STATUS.PLANNED,
	scheduled_time: "2026-09-19T08:30:00Z",
	acquisition_count: 0,
})
const STARTED_TODAY = visit("started-today", {
	status: ENCOUNTER_STATUS.IN_PROGRESS,
	started_at: "2026-09-19T06:30:00Z",
})
const STARTED_EARLIER = visit("started-earlier", {
	date: "2026-09-16",
	status: ENCOUNTER_STATUS.IN_PROGRESS,
	started_at: "2026-09-16T11:40:00Z",
})
const DONE_TWELFTH = visit("done-12", { date: "2026-09-12", started_at: "2026-09-12T06:50:00Z" })
const DONE_FOURTH = visit("done-4", { date: "2026-09-04", started_at: "2026-09-04T12:20:00Z" })
const DONE_AUGUST = visit("done-27", { date: "2026-08-27", started_at: "2026-08-27T08:05:00Z" })
const PLANNED_UNTIMED = visit("planned-22", {
	date: "2026-08-22",
	status: ENCOUNTER_STATUS.PLANNED,
	scheduled_time: null,
	acquisition_count: 0,
})
const CANCELLED = visit("cancelled", { date: "2026-08-20", status: ENCOUNTER_STATUS.CANCELLED })

const ALL = [
	DONE_AUGUST,
	CANCELLED,
	STARTED_TODAY,
	DONE_FOURTH,
	PLANNED_UNTIMED,
	STARTED_EARLIER,
	PLANNED_TODAY,
	DONE_TWELFTH,
]

function idsOf(visits: readonly Encounter[]): string[] {
	return visits.map((encounter) => encounter.encounter_id)
}

describe("visitSectionsOf", () => {
	it("CAP-014-S38 lists today first, then visits in progress from earlier days, then months newest first", () => {
		const sections = visitSectionsOf(ALL, TODAY)
		expect(sections.map((section) => section.kind)).toEqual([
			VISIT_SECTION.TODAY,
			VISIT_SECTION.IN_PROGRESS,
			VISIT_SECTION.MONTH,
			VISIT_SECTION.MONTH,
		])
		expect(sections.map((section) => idsOf(section.items))).toEqual([
			["planned-today", "started-today"],
			["started-earlier"],
			["done-12", "done-4"],
			["done-27", "planned-22"],
		])
	})

	it("CAP-014-R29 never shows a cancelled visit", () => {
		const shown = visitSectionsOf(ALL, TODAY).flatMap((section) => idsOf(section.items))
		expect(shown).not.toContain("cancelled")
	})

	it("CAP-014-S39 keeps a visit in progress from an earlier day out of its month", () => {
		const months = visitSectionsOf(ALL, TODAY).filter((section) => section.kind === VISIT_SECTION.MONTH)
		expect(months.flatMap((section) => idsOf(section.items))).not.toContain("started-earlier")
	})

	it("CAP-014-S26 leaves no section for a patient without visits", () => {
		expect(visitSectionsOf([], TODAY)).toEqual([])
	})
})

describe("visitSectionTitleOf", () => {
	it("CAP-015-R28 names the sections and the months in the interface language", () => {
		const titles = visitSectionsOf(ALL, TODAY).map((section) => visitSectionTitleOf(section, cs))
		expect(titles).toEqual(["Dnes", "Rozpracované", "Září 2026", "Srpen 2026"])
	})
})

describe("visitRowOf", () => {
	it("CAP-014-R24 shows the day, the weekday, the Prague time, the status and the records", () => {
		expect(visitRowOf(PLANNED_TODAY, cs)).toEqual({
			day: "19",
			weekday: "so",
			time: "10:30",
			status: { tone: PILL_TONE.INFO, label: "Plánovaná" },
			records: "bez záznamů",
		})
	})

	it("CAP-014-S13 never makes up a time the work list does not carry", () => {
		expect(visitRowOf(PLANNED_UNTIMED, cs).time).toBe("čas neurčen")
	})

	it("CAP-014-R18 marks a visit in progress and leaves a completed one without a badge", () => {
		expect(visitRowOf(STARTED_EARLIER, cs).status).toEqual({ tone: PILL_TONE.WARN, label: "Rozpracovaná" })
		expect(visitRowOf(DONE_TWELFTH, cs).status).toBeUndefined()
		expect(visitRowOf(DONE_TWELFTH, cs).records).toBe("2 záznamy")
	})
})

describe("sectionsInOrder", () => {
	it("E110 groups neighbours with the same key and keeps the order", () => {
		const sections = sectionsInOrder(["a1", "a2", "b1", "a3"], (item) => item.charAt(0))
		expect(sections).toEqual([
			{ key: "a", items: ["a1", "a2"] },
			{ key: "b", items: ["b1"] },
			{ key: "a", items: ["a3"] },
		])
	})
})

describe("sectionRowsOf", () => {
	it("E109 lays the sections out as rows with a title before each one", () => {
		const rows = sectionRowsOf(
			[
				{ key: "a", items: ["a1", "a2"] },
				{ key: "b", items: ["b1"] },
			],
			(section) => section.key.toUpperCase(),
			(item: string) => item,
		)
		expect(rows.map((row) => (row.kind === SECTION_ROW.HEADER ? `${row.title}:${row.isFirst}` : row.key))).toEqual([
			"A:true",
			"a1",
			"a2",
			"B:false",
			"b1",
		])
	})
})

describe("visitRowOf without a count", () => {
	it("CAP-014-R24 never makes up a zero the server did not send", () => {
		const { acquisition_count: _, ...withoutCount } = DONE_TWELFTH
		expect(visitRowOf(withoutCount, cs).records).toBeUndefined()
	})
})
