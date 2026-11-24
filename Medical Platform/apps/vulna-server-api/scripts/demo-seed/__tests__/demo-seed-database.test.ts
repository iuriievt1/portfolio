import { CODE_LIST } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { AcquisitionFileRepository } from "../../../src/app/acquisition/repositories/acquisition-file.repository"
import type { BinaryObjectService } from "../../../src/app/binary-object/services/binary-object.service"
import { ensureStandOperator, operatorOf, requireTitles, STAND_OPERATOR_USER_ID } from "../context"
import { DEMO_DATASET } from "../dataset"
import { planOf } from "../plan"
import { removeSeeded } from "../writer"
import { type FakeQuery, fakeTransaction } from "./fake-transaction"

const PATIENT_ID = "55555555-5555-4555-8555-555555555555"
const USER_ID = "11111111-1111-4111-8111-111111111111"
const DEPARTMENT_ID = "77777777-7777-4777-8777-777777777777"
const APP_RECORD = "a0000000-0000-4000-8000-0000000000ff"
const BINARY_OBJECT = "b0000000-0000-4000-8000-000000000001"
const PRODUCED_OBJECT = "b0000000-0000-4000-8000-000000000002"
const PRODUCED_TASK = "c0000000-0000-4000-8000-000000000003"
const MAIN_PATIENT = DEMO_DATASET.patients[0]

if (MAIN_PATIENT === undefined) {
	throw new Error("the demo dataset has no patient")
}
const PLAN = planOf(MAIN_PATIENT, PATIENT_ID)
const SEEDED_RECORDS = PLAN.acquisitions.map((acquisition) => ({ id: acquisition.id }))
const SEEDED_CHANGES = PLAN.changes.map((change) => ({ id: change.id }))

interface Rows {
	records: { id: string }[]
	changes: { id: string }[]
}

function removal(rows: Rows) {
	const removedObjects: string[][] = []
	const database = fakeTransaction((query: FakeQuery) => {
		if (query.text.startsWith("SELECT id FROM acquisition")) {
			return rows.records
		}
		if (query.text.startsWith("SELECT id FROM finding_wound_type_change")) {
			return rows.changes
		}
		if (query.text.startsWith("SELECT variant.binary_object_id AS id")) {
			return [{ id: PRODUCED_OBJECT }]
		}
		if (query.text.startsWith("SELECT task.id FROM queue_task task")) {
			return [{ id: PRODUCED_TASK }]
		}
		return []
	})
	const files = { binaryObjectIdsOf: async () => [BINARY_OBJECT] } as unknown as AcquisitionFileRepository
	const binaries = {
		removeAll: async (_tx: never, ids: readonly string[]) => {
			removedObjects.push([...ids])
		},
	} as unknown as BinaryObjectService
	return { ...database, files, binaries, removedObjects }
}

function deletes(queries: readonly FakeQuery[]): FakeQuery[] {
	return queries.filter((query) => query.text.startsWith("DELETE"))
}

describe("removal of the seeded demo CAP-026-R17", () => {
	it("removes only its own records and series and hands back the binary objects to discard after commit", async () => {
		const run = removal({ records: SEEDED_RECORDS, changes: SEEDED_CHANGES })
		const acquisitions = { helper: PLAN.acquisitions.map((acquisition) => acquisition.id), columns: [] }
		const tasks = { helper: [PRODUCED_TASK], columns: [] }

		const removed = await removeSeeded(run.tx, PLAN, run.files, run.binaries)

		expect(removed).toEqual([...PLAN.acquisitions.map(() => BINARY_OBJECT), PRODUCED_OBJECT])
		expect(run.removedObjects).toEqual([removed])
		const [taskSelection, ...repeated] = run.queries.filter((query) =>
			query.text.startsWith("SELECT task.id FROM queue_task task"),
		)
		expect(repeated).toEqual([])
		for (const owner of ["FROM image", "FROM document", "FROM document_page page", "FROM delivery_instance instance"]) {
			expect(taskSelection?.text).toContain(owner)
		}
		expect(deletes(run.queries)).toEqual([
			{
				text: "DELETE FROM administrator_alert WHERE delivery_id IN (SELECT id FROM delivery WHERE acquisition_id IN ?)",
				values: [acquisitions],
			},
			{ text: "DELETE FROM administrator_alert WHERE queue_task_id IN ?", values: [tasks] },
			{ text: "DELETE FROM queue_task WHERE id IN ?", values: [tasks] },
			{
				text: "DELETE FROM delivery_instance WHERE delivery_id IN (SELECT id FROM delivery WHERE acquisition_id IN ?)",
				values: [acquisitions],
			},
			{
				text: "DELETE FROM artifact_variant WHERE artifact_id IN (SELECT id FROM artifact WHERE acquisition_id IN ?)",
				values: [acquisitions],
			},
			{ text: "DELETE FROM artifact WHERE acquisition_id IN ?", values: [acquisitions] },
			{ text: "DELETE FROM delivery WHERE acquisition_id IN ?", values: [acquisitions] },
			{
				text: "DELETE FROM series WHERE finding_id IN ?",
				values: [{ helper: PLAN.findings.map((finding) => finding.id), columns: [] }],
			},
			{
				text: "DELETE FROM series WHERE document_id IN ?",
				values: [{ helper: PLAN.documents.map((document) => document.id), columns: [] }],
			},
			{
				text: "DELETE FROM acquisition WHERE id IN ?",
				values: [{ helper: PLAN.acquisitions.map((acquisition) => acquisition.id), columns: [] }],
			},
		])
	})

	it("CAP-020-R13 refuses while records captured in the app belong to demo wounds", async () => {
		const run = removal({ records: [...SEEDED_RECORDS, { id: APP_RECORD }], changes: SEEDED_CHANGES })

		await expect(removeSeeded(run.tx, PLAN, run.files, run.binaries)).rejects.toThrow("captured in the app")
		expect(deletes(run.queries)).toEqual([])
	})

	it("CAP-020-R21 refuses when the type of a demo wound was changed in the app, so its history survives", async () => {
		const run = removal({ records: SEEDED_RECORDS, changes: [...SEEDED_CHANGES, { id: APP_RECORD }] })

		await expect(removeSeeded(run.tx, PLAN, run.files, run.binaries)).rejects.toThrow(
			"wound type of a demo wound was changed in the app",
		)
		expect(deletes(run.queries)).toEqual([])
		expect(run.removedObjects).toEqual([])
	})
})

describe("document titles of the demo CAP-018-R15", () => {
	const titles = DEMO_DATASET.titles

	function catalogue(items: { code: string; name: string | null }[]) {
		return fakeTransaction((query) => (query.text.includes("code_list_item") ? items : []))
	}

	it("CAP-017-R08 takes the titles the code list offers under their own code", async () => {
		const run = catalogue(titles.map((title) => ({ code: title.code, name: null })))

		const codes = await requireTitles(run.tx, titles, "cs")

		expect([...codes.entries()]).toEqual(titles.map((title) => [title.code, title.code]))
	})

	it("CAP-017-R05 finds a title an administrator added under another code by its name in the default language", async () => {
		const [first, ...rest] = titles
		if (first === undefined) {
			throw new Error("the demo dataset has no title")
		}
		const run = catalogue([
			{ code: "admin-code", name: first.names.en ?? null },
			...rest.map((title) => ({ code: title.code, name: null })),
		])

		const codes = await requireTitles(run.tx, titles, "en")

		expect(codes.get(first.code)).toBe("admin-code")
		expect(run.queries[0]?.values).toContain("en")
	})

	it("CAP-025-R03 refuses missing titles instead of writing the code list without an audit", async () => {
		const run = catalogue([])

		await expect(requireTitles(run.tx, titles, "cs")).rejects.toThrow(CODE_LIST.DOCUMENT_TITLE)
		expect(run.queries.map((query) => query.text.split(" ")[0])).toEqual(["SELECT"])
	})
})

describe("operator of the demo CAP-020-R04", () => {
	function clinicians(count: number) {
		const rows = Array.from({ length: count }, () => ({ id: USER_ID, department_id: DEPARTMENT_ID }))
		return fakeTransaction(() => rows)
	}

	it("CAP-003-R07 takes the only active clinician with a department", async () => {
		expect(await operatorOf(clinicians(1).tx, undefined)).toEqual({ userId: USER_ID, departmentId: DEPARTMENT_ID })
	})

	it("asks for a sign-in when no clinician has a department", async () => {
		await expect(operatorOf(clinicians(0).tx, undefined)).rejects.toThrow("sign in once in the app")
	})

	it("asks for the personal number as the argument when more clinicians qualify", async () => {
		const failure = operatorOf(clinicians(2).tx, undefined)

		await expect(failure).rejects.toThrow("pnpm db:seed-demo <personal number>")
		await expect(failure).rejects.not.toThrow("DEMO_PERSONAL_NUMBER")
	})
})

// Q-040, CAP-020-R04
describe("department of the stand operator", () => {
	const visitStarts = DEMO_DATASET.patients.flatMap((patient) =>
		patient.visits.map((visit) => Date.parse(visit.startedAt)),
	)

	function historyOf(queries: readonly FakeQuery[]): FakeQuery[] {
		return queries.filter((query) => query.text.startsWith("INSERT INTO user_department_history"))
	}

	it("ADR-050 (doplnění D34) bod 4 makes the department of the stand operator valid from the first demo visit on", async () => {
		const run = fakeTransaction(() => [])

		await ensureStandOperator(run.tx, DEMO_DATASET)

		const [history] = historyOf(run.queries)
		const validFrom = history?.values.find((value): value is Date => value instanceof Date)
		expect(historyOf(run.queries)).toHaveLength(1)
		expect(history?.values).toContain(STAND_OPERATOR_USER_ID)
		expect(visitStarts).toContain(validFrom?.getTime())
		expect(visitStarts.every((start) => start >= (validFrom?.getTime() ?? Number.POSITIVE_INFINITY))).toBe(true)
	})

	it("adds the department history only while the stand operator has none", async () => {
		const run = fakeTransaction(() => [])

		await ensureStandOperator(run.tx, DEMO_DATASET)

		expect(historyOf(run.queries)[0]?.text).toContain(
			"NOT EXISTS (SELECT 1 FROM user_department_history h WHERE h.user_id = u.id)",
		)
	})
})
