import { bodySiteProblemOf } from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import { bodySiteIn } from "../body-site"
import { DEMO_DATASET } from "../dataset"
import { demoId, studyInstanceUidOf } from "../demo-id"
import { planOf } from "../plan"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const PATIENT_ID = "55555555-5555-4555-8555-555555555555"
const MAIN_PATIENT = DEMO_DATASET.patients[0]
const ONE_MINUTE_MILLISECONDS = 60_000

describe("demo identifiers", () => {
	it("gives the same name the same identifier on every run", () => {
		expect(demoId("prochazkova-eva/visit/v1")).toBe(demoId("prochazkova-eva/visit/v1"))
		expect(demoId("prochazkova-eva/visit/v1")).not.toBe(demoId("prochazkova-eva/visit/v2"))
		expect(demoId("prochazkova-eva/visit/v1")).toMatch(UUID)
	})

	it("NAB-370 derives the study under the 2.25 root", () => {
		expect(studyInstanceUidOf(demoId("visit"))).toMatch(/^2\.25\.\d+$/)
	})
})

describe("demo wounds on the body diagram CAP-016-R06", () => {
	const wounds = DEMO_DATASET.patients.flatMap((patient) => patient.wounds)

	it.each(wounds.map((wound) => [wound.key, wound] as const))(
		"CAP-016-R16 places %s inside its region",
		(_key, wound) => {
			const site = bodySiteIn(wound.regionCode, wound.view, wound.laterality)

			expect(bodySiteProblemOf(site)).toBeUndefined()
			expect(site.laterality).toBe(wound.laterality)
		},
	)

	it("spreads the wounds of the main patient over both views", () => {
		const views = new Set(MAIN_PATIENT?.wounds.map((wound) => wound.view))

		expect(MAIN_PATIENT?.wounds).toHaveLength(10)
		expect([...views].sort()).toEqual(["anterior", "posterior"])
	})
})

describe("demo plan", () => {
	if (MAIN_PATIENT === undefined) {
		throw new Error("the demo dataset has no patient")
	}
	const plan = planOf(MAIN_PATIENT, PATIENT_ID)

	it("CAP-014-R03 closes every record within its visit", () => {
		for (const patient of DEMO_DATASET.patients) {
			const visits = new Map(patient.visits.map((visit) => [visit.key, visit]))
			const moments = [
				...patient.wounds.flatMap((wound) => wound.records.map((record) => [record.visit, record.closedAt] as const)),
				...patient.documents.map((document) => [document.visit, document.closedAt] as const),
			]
			for (const [visitKey, closedAt] of moments) {
				const visit = visits.get(visitKey)
				expect(visit).toBeDefined()
				expect(Date.parse(closedAt)).toBeGreaterThan(Date.parse(visit?.startedAt ?? ""))
				expect(Date.parse(closedAt)).toBeLessThan(Date.parse(visit?.completedAt ?? ""))
			}
		}
	})

	it("CAP-020-R13 makes the first closed record the origin of its finding", () => {
		for (const finding of plan.findings) {
			const records = plan.acquisitions.filter((acquisition) => acquisition.finding_id === finding.id)
			const first = [...records].sort((a, b) => a.closed_at.getTime() - b.closed_at.getTime())[0]

			expect(finding.origin_acquisition_id).toBe(first?.id)
			expect(finding.created_at.getTime()).toBeLessThan(first?.closed_at.getTime() ?? 0)
		}
	})

	it("CAP-020-S25 changes the type of the right lower leg between its first and second record", () => {
		expect(plan.changes).toEqual([
			expect.objectContaining({ previous_wound_type_code: "traumatic-wound", wound_type_code: "leg-ulcer" }),
		])
	})

	it("CAP-020-S25 snapshots the type each record of the changed wound closed with", () => {
		const finding = plan.changes[0]?.finding_id
		const records = plan.acquisitions
			.filter((acquisition) => acquisition.finding_id === finding)
			.map((acquisition) => acquisition.closed_wound_type_code)

		expect(records).toEqual(["traumatic-wound", "leg-ulcer", "leg-ulcer", "leg-ulcer"])
	})

	it.each([
		["at", 0],
		["before", ONE_MINUTE_MILLISECONDS],
	])("CAP-020-R21 refuses a wound type change dated %s the first closed record of its wound", (_moment, earlier) => {
		const wound = MAIN_PATIENT.wounds.find((candidate) => candidate.change !== undefined)
		const firstClosedAt = Math.min(...(wound?.records.map((record) => Date.parse(record.closedAt)) ?? []))
		if (wound?.change === undefined) {
			throw new Error("the main patient has no wound whose type changes")
		}
		const early = { ...wound, change: { ...wound.change, changedAt: new Date(firstClosedAt - earlier).toISOString() } }

		expect(() => planOf({ ...MAIN_PATIENT, wounds: [early] }, PATIENT_ID)).toThrow("not after its first closed record")
	})

	it("CAP-020-R19 gives a scanned document no wound type", () => {
		const scans = plan.acquisitions.filter((acquisition) => acquisition.finding_id === null)

		expect(scans.map((scan) => scan.closed_wound_type_code)).toEqual(scans.map(() => null))
	})

	it("CAP-021-R25 counts the files of every record and numbers them from one", () => {
		for (const acquisition of plan.acquisitions) {
			const files = [...plan.images, ...plan.pages].filter((file) => file.acquisition_id === acquisition.id)

			expect(files).toHaveLength(acquisition.file_count)
			expect(files.map((file) => file.sequence)).toEqual(files.map((_file, index) => index + 1))
		}
	})

	it("CAP-014-R24 dates every visit in the time zone of the instance", () => {
		expect(plan.encounters.map((encounter) => encounter.date)).toEqual([
			"2026-08-07",
			"2026-08-14",
			"2026-08-27",
			"2026-09-04",
			"2026-09-12",
			"2026-09-26",
		])
	})

	it("CAP-018-R15 seeds the five documents of Figma 08 A.1", () => {
		expect(plan.documents.map((document) => document.title)).toEqual([
			"discharge-report",
			"request-form",
			"lab-results",
			"medical-report",
			"photo-consent",
		])
		expect(plan.pages.filter((page) => page.asset_name === "page-3.jpg")).toHaveLength(2)
	})
})
