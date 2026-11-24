import { ACQUISITION_KIND, DISCARD_SITUATION, EMPTIED_BY, ENCOUNTER_STATUS, ERROR_CODE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE } from "@ansora/core-server"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import { acquisitionRow, CURRENT, encounterRow, NOW, problemOf } from "../../encounter/__tests__/encounter-fixtures"
import { DECISION_REASON } from "../constants/acquisition.constants"
import { FILE_STATUS } from "../constants/acquisition-file.constants"
import { DRAFT_ID, detailsOf, FILE_A, FILE_B, fileHarness } from "./acquisition-file-fixtures"

const VERSION = 3
const DISCARD = { acquisitionId: DRAFT_ID, version: VERSION, situation: DISCARD_SITUATION.EXPLICIT_DISCARD }
const SCAN_DOCUMENT = {
	id: "d1000000-0000-4000-8000-000000000001",
	acquisition_id: DRAFT_ID,
	title_code: null,
	title_text: null,
	title_code_list_version: null,
}

describe("draft record discarded by its operator CAP-015-R17", () => {
	it("CAP-025-R20 deletes the record with its files, withdraws its clinical content and audits the situation", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }))
		run.files.received(FILE_A)
		run.files.add({ file_key: FILE_B })

		await run.discards.discard(CURRENT, DISCARD, NOW)

		expect(run.drafts.rows.size).toBe(0)
		expect(run.drafts.decided.get(DRAFT_ID)).toBe(DECISION_REASON.DISCARDED)
		expect(run.steps).toEqual(["withdraw assessment", "withdraw new finding"])
		expect(run.binaries.removedRows).toEqual([`object-of-${FILE_A}`, `thumbnail-of-${FILE_A}`])
		expect(run.binaries.discardedBytes).toEqual([`object-of-${FILE_A}`, `thumbnail-of-${FILE_A}`])
		expect(run.audits[0]?.eventType).toBe(AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_DISCARD)
		expect(detailsOf(run.audits[0])).toMatchObject({
			acquisition_id: DRAFT_ID,
			situation: DISCARD_SITUATION.EXPLICIT_DISCARD,
			discarded_file_count: 2,
		})
	})

	it("CAP-021-S28 never queues an upload of a discarded record and deletes its bytes only from the buffer", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }))
		run.files.received(FILE_A)
		run.files.received(FILE_B)

		await run.discards.discard(CURRENT, DISCARD, NOW)

		expect(run.closing.queuedUploads).toEqual([])
		expect(run.closing.storeWrites).toBe(0)
		expect(run.binaries.discardedBytes).toEqual([
			`object-of-${FILE_A}`,
			`thumbnail-of-${FILE_A}`,
			`object-of-${FILE_B}`,
			`thumbnail-of-${FILE_B}`,
		])
	})

	it("CAP-021-R39 withdraws the scanned document of a discarded scan from the clinical record", async () => {
		const run = fileHarness(acquisitionRow({ kind: ACQUISITION_KIND.SCAN, version: VERSION }), {
			document: SCAN_DOCUMENT,
		})

		await run.discards.discard(CURRENT, DISCARD, NOW)

		expect(run.steps).toEqual(["withdraw assessment", "withdraw new finding", `withdraw document:${SCAN_DOCUMENT.id}`])
		expect(run.drafts.rows.size).toBe(0)
	})

	it("CAP-021-R39 refuses to discard a scan that lost its document", async () => {
		const run = fileHarness(acquisitionRow({ kind: ACQUISITION_KIND.SCAN, version: VERSION }))

		await expect(run.discards.discard(CURRENT, DISCARD, NOW)).rejects.toThrow(`the scan ${DRAFT_ID} has no document`)
		expect(run.drafts.rows.size).toBe(1)
	})

	it("CAP-014-S51 returns the planned visit that lost its only record and records it", async () => {
		const emptied = encounterRow({ status: ENCOUNTER_STATUS.PLANNED })
		const run = fileHarness(acquisitionRow({ version: VERSION }), { emptied })

		await run.discards.discard(CURRENT, DISCARD, NOW)

		expect(run.steps).toContain(`record encounter:${ENCOUNTER_STATUS.PLANNED}`)
		expect(run.emptiedActs.map((act) => act.emptiedBy)).toEqual([EMPTIED_BY.DISCARD])
	})

	it("CAP-021-R29 answers a repeated discard without a second audit", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }))
		run.drafts.rows.clear()
		run.drafts.decided.set(DRAFT_ID, DECISION_REASON.DISCARDED)

		await run.discards.discard(CURRENT, DISCARD, NOW)

		expect(run.audits).toEqual([])
	})

	it("refuses to discard a closed record", async () => {
		const run = fileHarness(acquisitionRow({ state: ACQUISITION_STATE.RECEIVED, closed_at: NOW, file_count: 1 }))

		const problem = await problemOf(run.discards.discard(CURRENT, DISCARD, NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_CLOSED)
	})

	it("CAP-021-R32 refuses a discard over another version", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION + 1 }))

		const problem = await problemOf(run.discards.discard(CURRENT, DISCARD, NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_VERSION_CONFLICT)
		expect(run.drafts.rows.size).toBe(1)
	})

	it("answers an unknown record as missing", async () => {
		const run = fileHarness()
		run.drafts.rows.clear()

		const problem = await problemOf(run.discards.discard(CURRENT, DISCARD, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})
})

describe("empty draft record cancelled CAP-015-R37", () => {
	it("CAP-015-S54 cancels a record without files and audits the cancellation", async () => {
		const emptied = encounterRow({ status: ENCOUNTER_STATUS.CANCELLED })
		const run = fileHarness(acquisitionRow(), { emptied })

		await run.cancellations.cancel(CURRENT, DRAFT_ID, NOW)

		expect(run.drafts.rows.size).toBe(0)
		expect(run.drafts.decided.get(DRAFT_ID)).toBe(DECISION_REASON.CANCELLED)
		expect(run.audits.map((event) => event.eventType)).toEqual([AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_CANCELLED])
		expect(run.emptiedActs.map((act) => act.emptiedBy)).toEqual([EMPTIED_BY.CANCELLATION])
	})

	it("CAP-015-S55 refuses to cancel a record with a file", async () => {
		const run = fileHarness()
		run.files.add({ file_key: FILE_A })

		const problem = await problemOf(run.cancellations.cancel(CURRENT, DRAFT_ID, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_HAS_FILES)
		expect(run.drafts.rows.size).toBe(1)
	})

	it("cancels a record whose only file was removed", async () => {
		const run = fileHarness()
		run.files.add({ file_key: FILE_A, status: FILE_STATUS.REMOVED })

		await run.cancellations.cancel(CURRENT, DRAFT_ID, NOW)

		expect(run.drafts.rows.size).toBe(0)
	})

	it("CAP-021-R29 answers a repeated cancellation without a second audit", async () => {
		const run = fileHarness()
		run.drafts.rows.clear()
		run.drafts.decided.set(DRAFT_ID, DECISION_REASON.CANCELLED)

		await run.cancellations.cancel(CURRENT, DRAFT_ID, NOW)

		expect(run.audits).toEqual([])
	})

	it("refuses to cancel a closed record", async () => {
		const run = fileHarness(acquisitionRow({ state: ACQUISITION_STATE.RECEIVED, closed_at: NOW, file_count: 1 }))

		const problem = await problemOf(run.cancellations.cancel(CURRENT, DRAFT_ID, NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_CLOSED)
	})
})
