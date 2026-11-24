import { ERROR_CODE } from "@ansora/contracts"
import type { BodySite } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import type { FindingRecordService } from "../../clinical-record/services/finding-record.service"
import type { DraftFindingRecord, WithdrawnFindingRecord } from "../../clinical-record/types/clinical-record.types"
import { DEPARTMENT, OTHER_PATIENT, PATIENT, problemOf, USER } from "../../encounter/__tests__/encounter-fixtures"
import type { BodySiteRepository } from "../repositories/body-site.repository"
import type { FindingRepository } from "../repositories/finding.repository"
import { FindingLocationService } from "../services/finding-location.service"
import type { BodySiteRow, FindingRow, LocatedDraft, NewFinding } from "../types/finding.types"

const TX = {} as postgres.TransactionSql
const DRAFT_ID = "a0000000-0000-4000-8000-000000000001"
const OTHER_DRAFT_ID = "a0000000-0000-4000-8000-000000000002"
const KEY = "b0000000-0000-4000-8000-000000000001"
const OTHER_KEY = "b0000000-0000-4000-8000-000000000002"
const TRACKED = "c0000000-0000-4000-8000-000000000001"
const CLOSED_ACQUISITION = "a0000000-0000-4000-8000-0000000000c1"
const OTHER_DEPARTMENT = "70000000-0000-4000-8000-000000000002"

const RIGHT_KNEE: BodySite = {
	regionCode: "181553006",
	laterality: "R",
	view: "anterior",
	x: 75 / 200,
	y: 302 / 400,
	bodyDiagramVersion: "1",
}

const SACRUM: BodySite = {
	regionCode: "51027004",
	laterality: null,
	view: "posterior",
	x: 0.5,
	y: 185 / 400,
	bodyDiagramVersion: "1",
}

const DRAFT: LocatedDraft = { id: DRAFT_ID, patient_id: PATIENT, department_id: DEPARTMENT, finding_id: null }

function rowOf(acquisitionId: string, site: BodySite): BodySiteRow {
	return {
		acquisition_id: acquisitionId,
		region_code: site.regionCode,
		laterality: site.laterality,
		view: site.view,
		x: site.x,
		y: site.y,
		body_diagram_version: site.bodyDiagramVersion,
	}
}

function findingRow(overrides: Partial<FindingRow> = {}): FindingRow {
	return {
		id: TRACKED,
		patient_id: PATIENT,
		department_id: DEPARTMENT,
		finding_key: OTHER_KEY,
		origin_acquisition_id: CLOSED_ACQUISITION,
		created_by: USER,
		created_at: new Date("2026-09-01T08:00:00Z"),
		wound_type_code: null,
		wound_type_code_list_version: null,
		wound_type_set_by: null,
		...overrides,
	}
}

function harness(existing: FindingRow[] = [], closed: Map<string, BodySite> = new Map()) {
	const findings = new Map(existing.map((row) => [row.id, row]))
	const sites = new Map<string, BodySiteRow>()
	const recorded: DraftFindingRecord[] = []
	const withdrawn: WithdrawnFindingRecord[] = []
	const detached: string[] = []
	let counter = 0
	const findingRepository = {
		findById: async (_sql: never, id: string) => findings.get(id),
		findByKey: async (_sql: never, key: string) => [...findings.values()].find((row) => row.finding_key === key),
		newFindingOf: async (_sql: never, acquisitionId: string) =>
			[...findings.values()].find((row) => row.origin_acquisition_id === acquisitionId),
		hasClosedRecord: async (_sql: never, id: string) => closed.has(id),
		insert: async (_tx: never, finding: NewFinding) => {
			counter += 1
			const row = findingRow({
				id: `d0000000-0000-4000-8000-00000000000${counter}`,
				patient_id: finding.patientId,
				department_id: finding.departmentId,
				finding_key: finding.findingKey,
				origin_acquisition_id: finding.originAcquisitionId,
				created_by: finding.createdBy,
			})
			findings.set(row.id, row)
			return row
		},
		detachFrom: async (_tx: never, acquisitionId: string, findingId: string) => {
			detached.push(`${acquisitionId}:${findingId}`)
		},
		delete: async (_tx: never, id: string) => {
			findings.delete(id)
		},
	} as unknown as FindingRepository
	const siteRepository = {
		upsert: async (_tx: never, acquisitionId: string, site: BodySite) => {
			sites.set(acquisitionId, rowOf(acquisitionId, site))
		},
		findByAcquisition: async (_sql: never, acquisitionId: string) => sites.get(acquisitionId),
		lastClosedOf: async (_sql: never, findingId: string) => {
			const site = closed.get(findingId)
			return site === undefined ? undefined : rowOf(CLOSED_ACQUISITION, site)
		},
		delete: async (_tx: never, acquisitionId: string) => {
			sites.delete(acquisitionId)
		},
	} as unknown as BodySiteRepository
	const records = {
		recordDraft: async (_tx: never, record: DraftFindingRecord) => {
			recorded.push(record)
		},
		withdrawDraft: async (_tx: never, record: WithdrawnFindingRecord) => {
			withdrawn.push(record)
		},
	} as unknown as FindingRecordService
	const service = new FindingLocationService(findingRepository, siteRepository, records)
	return { service, findings, sites, recorded, withdrawn, detached }
}

describe("new finding placed on the body diagram", () => {
	it("CAP-016-S01 founds a finding of the draft and records it with its body site", async () => {
		const run = harness()

		const findingId = await run.service.placeNew(TX, DRAFT, KEY, SACRUM, USER)

		expect(run.findings.get(findingId)).toMatchObject({
			patient_id: PATIENT,
			department_id: DEPARTMENT,
			finding_key: KEY,
			origin_acquisition_id: DRAFT_ID,
			created_by: USER,
		})
		expect(run.sites.get(DRAFT_ID)).toEqual(rowOf(DRAFT_ID, SACRUM))
		expect(run.recorded).toEqual([
			{ findingId, acquisitionId: DRAFT_ID, patientId: PATIENT, departmentId: DEPARTMENT, site: SACRUM },
		])
	})

	it("CAP-016-S06 moves the same finding when the place is marked again, a second finding never appears", async () => {
		const run = harness()
		const first = await run.service.placeNew(TX, DRAFT, KEY, SACRUM, USER)

		const second = await run.service.placeNew(TX, { ...DRAFT, finding_id: first }, OTHER_KEY, RIGHT_KNEE, USER)

		expect(second).toBe(first)
		expect(run.findings.size).toBe(1)
		expect(run.sites.get(DRAFT_ID)).toEqual(rowOf(DRAFT_ID, RIGHT_KNEE))
		expect(run.recorded.map((record) => record.site)).toEqual([SACRUM, RIGHT_KNEE])
	})

	it("CAP-021-R29 refuses a key the server keeps for the finding of another draft", async () => {
		const run = harness([findingRow({ finding_key: KEY, origin_acquisition_id: OTHER_DRAFT_ID })])

		const problem = await problemOf(run.service.placeNew(TX, DRAFT, KEY, SACRUM, USER))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.IDEMPOTENCY_CONFLICT)
	})

	it("CAP-016-S02 refuses a point outside the silhouette and keeps nothing", async () => {
		const run = harness()

		const problem = await problemOf(run.service.placeNew(TX, DRAFT, KEY, { ...SACRUM, x: 0.01, y: 0.01 }, USER))

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(run.findings.size).toBe(0)
		expect(run.sites.size).toBe(0)
		expect(run.recorded).toEqual([])
	})

	it("CAP-016-R16 refuses the side of the screen sent as the side of the patient", async () => {
		const run = harness()

		const problem = await problemOf(run.service.placeNew(TX, DRAFT, KEY, { ...RIGHT_KNEE, laterality: "L" }, USER))

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})

	it("CAP-016-S09 moves only a finding the draft founded itself", async () => {
		const run = harness()

		const problem = await problemOf(run.service.moveNew(TX, DRAFT, SACRUM))

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})
})

describe("existing finding chosen on the body diagram", () => {
	const tracked = findingRow()
	const closedSites = new Map([[TRACKED, RIGHT_KNEE]])

	it("CAP-016-S10 takes over the place of the finding without recording a new one", async () => {
		const run = harness([tracked], closedSites)

		const findingId = await run.service.chooseExisting(TX, DRAFT, TRACKED, undefined)

		expect(findingId).toBe(TRACKED)
		expect(run.sites.get(DRAFT_ID)).toEqual(rowOf(DRAFT_ID, RIGHT_KNEE))
		expect(run.recorded).toEqual([])
	})

	it("ADR-050 (doplnění D33) bod 3 withdraws the new finding the draft founded before", async () => {
		const run = harness([tracked], closedSites)
		const own = await run.service.placeNew(TX, DRAFT, KEY, SACRUM, USER)

		await run.service.chooseExisting(TX, { ...DRAFT, finding_id: own }, TRACKED, undefined)

		expect(run.withdrawn.map((record) => [record.findingId, record.site])).toEqual([[own, SACRUM]])
		expect(run.detached).toEqual([`${DRAFT_ID}:${own}`])
		expect(run.findings.has(own)).toBe(false)
	})

	it("CAP-014-S44 refuses a finding of another patient", async () => {
		const run = harness([findingRow({ patient_id: OTHER_PATIENT })], closedSites)

		const problem = await problemOf(run.service.chooseExisting(TX, DRAFT, TRACKED, undefined))

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.PATIENT_MISMATCH)
	})

	it("CAP-020-R13 hides the new finding of another draft", async () => {
		const run = harness([findingRow({ origin_acquisition_id: OTHER_DRAFT_ID })])

		const problem = await problemOf(run.service.chooseExisting(TX, DRAFT, TRACKED, undefined))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})

	it("refuses an unknown finding", async () => {
		const run = harness()

		const problem = await problemOf(run.service.chooseExisting(TX, DRAFT, TRACKED, undefined))

		expect(problem.code).toBe(ERROR_CODE.RESOURCE_NOT_FOUND)
	})

	it("CAP-016-R17 refuses another place than the one of the finding", async () => {
		const run = harness([tracked], closedSites)

		const problem = await problemOf(run.service.chooseExisting(TX, DRAFT, TRACKED, SACRUM))

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})

	it("CAP-020-R04 hides a finding of another department and withdraws nothing", async () => {
		const run = harness([findingRow({ department_id: OTHER_DEPARTMENT })], closedSites)
		const own = await run.service.placeNew(TX, DRAFT, KEY, SACRUM, USER)

		const problem = await problemOf(run.service.chooseExisting(TX, { ...DRAFT, finding_id: own }, TRACKED, undefined))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
		expect(problem.code).toBe(ERROR_CODE.RESOURCE_NOT_FOUND)
		expect(run.withdrawn).toEqual([])
		expect(run.sites.get(DRAFT_ID)).toEqual(rowOf(DRAFT_ID, SACRUM))
	})

	it("CAP-020-R04 hides a finding without a department from a draft without one", async () => {
		const run = harness([findingRow({ department_id: null })], closedSites)

		const problem = await problemOf(
			run.service.chooseExisting(TX, { ...DRAFT, department_id: null }, TRACKED, undefined),
		)

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})

	it("CAP-016-R17 checks the finding without writing anything", async () => {
		const run = harness([tracked], closedSites)

		const chosen = await run.service.checkExisting(TX, DRAFT, TRACKED, undefined)

		expect(chosen).toEqual({ finding: tracked, closedSite: RIGHT_KNEE })
		expect(run.sites.size).toBe(0)
		expect(run.withdrawn).toEqual([])
	})

	it("CAP-020-R13 keeps the own new finding of the draft even without a department", async () => {
		const run = harness()
		const draft = { ...DRAFT, department_id: null }
		const own = await run.service.placeNew(TX, draft, KEY, SACRUM, USER)

		const chosen = await run.service.checkExisting(TX, { ...draft, finding_id: own }, own, undefined)

		expect(chosen.finding.id).toBe(own)
		expect(chosen.closedSite).toBeUndefined()
	})
})

describe("tracked finding of a patient CAP-020-R04", () => {
	const closedSites = new Map([[TRACKED, RIGHT_KNEE]])

	it("CAP-014-S46 hands over a finding of the patient with a closed record in the department", async () => {
		const run = harness([findingRow()], closedSites)

		const finding = await run.service.trackedFinding(TX, TRACKED, PATIENT, DEPARTMENT)

		expect(finding.id).toBe(TRACKED)
	})

	it("CAP-020-R04 hides a finding of another department", async () => {
		const run = harness([findingRow({ department_id: OTHER_DEPARTMENT })], closedSites)

		const problem = await problemOf(run.service.trackedFinding(TX, TRACKED, PATIENT, DEPARTMENT))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})

	it("CAP-014-S44 refuses a finding of another patient", async () => {
		const run = harness([findingRow()], closedSites)

		const problem = await problemOf(run.service.trackedFinding(TX, TRACKED, OTHER_PATIENT, DEPARTMENT))

		expect(problem.code).toBe(ERROR_CODE.PATIENT_MISMATCH)
	})

	it("CAP-020-R13 hides a finding without a closed record", async () => {
		const run = harness([findingRow()])

		const problem = await problemOf(run.service.trackedFinding(TX, TRACKED, PATIENT, DEPARTMENT))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})
})

describe("finding of a draft that moves or is cleared", () => {
	it("withdraws the new finding and forgets the place when the finding is cleared", async () => {
		const run = harness()
		const own = await run.service.placeNew(TX, DRAFT, KEY, SACRUM, USER)

		await run.service.clear(TX, { ...DRAFT, finding_id: own })

		expect(run.withdrawn.map((record) => record.findingId)).toEqual([own])
		expect(run.sites.size).toBe(0)
	})

	it("ADR-050 (doplnění D33) bod 3 withdraws the wound type of a typed new finding with it", async () => {
		const run = harness()
		const own = await run.service.placeNew(TX, DRAFT, KEY, SACRUM, USER)
		const finding = run.findings.get(own)
		if (finding === undefined) {
			throw new Error("the new finding is missing")
		}
		run.findings.set(own, {
			...finding,
			wound_type_code: "leg-ulcer",
			wound_type_code_list_version: 1,
			wound_type_set_by: USER,
		})

		await run.service.clear(TX, { ...DRAFT, finding_id: own })

		expect(run.withdrawn).toEqual([
			expect.objectContaining({ findingId: own, acquisitionId: DRAFT_ID, woundTypeCode: "leg-ulcer" }),
		])
	})

	it("CAP-014-S47 withdraws the new finding and the place when the draft moves to another patient", async () => {
		const run = harness()
		const own = await run.service.placeNew(TX, DRAFT, KEY, SACRUM, USER)

		await run.service.followAssignment(TX, { ...DRAFT, finding_id: own }, null)

		expect(run.withdrawn.map((record) => record.findingId)).toEqual([own])
		expect(run.sites.size).toBe(0)
	})

	it("CAP-014-S46 takes over the place of the finding of the new patient", async () => {
		const run = harness([], new Map([[TRACKED, RIGHT_KNEE]]))

		await run.service.followAssignment(TX, DRAFT, TRACKED)

		expect(run.sites.get(DRAFT_ID)).toEqual(rowOf(DRAFT_ID, RIGHT_KNEE))
	})

	it("keeps the finding when the draft stays with it", async () => {
		const run = harness()
		const own = await run.service.placeNew(TX, DRAFT, KEY, SACRUM, USER)

		await run.service.followAssignment(TX, { ...DRAFT, finding_id: own }, own)

		expect(run.withdrawn).toEqual([])
		expect(run.sites.get(DRAFT_ID)).toEqual(rowOf(DRAFT_ID, SACRUM))
	})
})
