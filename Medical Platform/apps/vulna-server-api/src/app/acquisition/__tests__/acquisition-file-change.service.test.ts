import { ERROR_CODE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE } from "@ansora/core-server"
import { ACQUISITION_STATE, EDIT_KIND } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import { acquisitionRow, CURRENT, NOW, problemOf } from "../../encounter/__tests__/encounter-fixtures"
import { FILE_STATUS } from "../constants/acquisition-file.constants"
import type { FileReplacement } from "../types/acquisition-file.types"
import {
	DRAFT_ID,
	detailsOf,
	FILE_A,
	FILE_B,
	FILE_C,
	fileHarness,
	jpegWith,
	plainContent,
	sha256Of,
} from "./acquisition-file-fixtures"

const VERSION = 4
const CROPPED = jpegWith(undefined)

function replacementOf(overrides: Partial<FileReplacement> = {}): FileReplacement {
	return {
		acquisitionId: DRAFT_ID,
		fileKey: FILE_A,
		version: VERSION,
		sha256: sha256Of(CROPPED),
		edit: EDIT_KIND.CROP,
		content: plainContent(CROPPED, Buffer.from("cropped thumbnail")),
		...overrides,
	}
}

describe("file removed from the draft record CAP-015-R18", () => {
	it("CAP-026-R17 removes the file, deletes its objects after the transaction and audits an update", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }))
		run.files.received(FILE_A)

		await run.removals.remove(CURRENT, { acquisitionId: DRAFT_ID, fileKey: FILE_A, version: VERSION }, NOW)

		expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.REMOVED)
		expect(run.binaries.removedRows).toEqual([`object-of-${FILE_A}`, `thumbnail-of-${FILE_A}`])
		expect(run.binaries.discardedBytes).toEqual([`object-of-${FILE_A}`, `thumbnail-of-${FILE_A}`])
		expect(run.drafts.draft.version).toBe(VERSION + 1)
		expect(run.audits.map((event) => event.eventType)).toEqual([AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_UPDATED])
	})

	it("CAP-015-R35 removes a file still pending on another device", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }))
		run.files.add({ file_key: FILE_A })

		await run.removals.remove(CURRENT, { acquisitionId: DRAFT_ID, fileKey: FILE_A, version: VERSION }, NOW)

		expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.REMOVED)
		expect(run.binaries.discardedBytes).toEqual([])
	})

	it("CAP-021-R29 answers a repeated removal without a version check or audit", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION + 1 }))
		run.files.add({ file_key: FILE_A, status: FILE_STATUS.REMOVED })

		await run.removals.remove(CURRENT, { acquisitionId: DRAFT_ID, fileKey: FILE_A, version: VERSION }, NOW)

		expect(run.audits).toEqual([])
	})

	it("CAP-015-S52 refuses a removal over another version", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION + 1 }))
		run.files.received(FILE_A)

		const problem = await problemOf(
			run.removals.remove(CURRENT, { acquisitionId: DRAFT_ID, fileKey: FILE_A, version: VERSION }, NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_VERSION_CONFLICT)
		expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.RECEIVED)
	})

	it("CAP-014-R07 leaves a closed record unchanged", async () => {
		const run = fileHarness(acquisitionRow({ state: ACQUISITION_STATE.RECEIVED, closed_at: NOW, file_count: 1 }))
		run.files.received(FILE_A)

		const problem = await problemOf(
			run.removals.remove(CURRENT, { acquisitionId: DRAFT_ID, fileKey: FILE_A, version: VERSION }, NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_CLOSED)
	})

	it("answers an unknown file as missing", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }))

		const problem = await problemOf(
			run.removals.remove(CURRENT, { acquisitionId: DRAFT_ID, fileKey: FILE_A, version: VERSION }, NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})
})

describe("file replaced by its rotated or cropped form CAP-015-R34", () => {
	it("CAP-025-S26 replaces the content, keeps the original fingerprint and deletes the former objects", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }))
		const original = { ...run.files.received(FILE_A) }

		const view = await run.replacements.replace(CURRENT, replacementOf(), NOW)

		const replaced = run.files.byKey(FILE_A)
		expect(view).toMatchObject({ file_key: FILE_A, sequence: original.sequence, edit: EDIT_KIND.CROP })
		expect(replaced).toMatchObject({
			sha256: sha256Of(CROPPED),
			original_upload_sha256: original.sha256,
			edited_at: NOW,
		})
		expect(run.binaries.stored.get(replaced?.binary_object_id ?? "")).toEqual(CROPPED)
		expect(run.binaries.removedRows).toEqual([`object-of-${FILE_A}`, `thumbnail-of-${FILE_A}`])
		expect(run.binaries.discardedBytes).toEqual([`object-of-${FILE_A}`, `thumbnail-of-${FILE_A}`])
		expect(run.audits[0]?.eventType).toBe(AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_FILE_REPLACED)
		expect(detailsOf(run.audits[0])).toMatchObject({ file_edit: { file_key: FILE_A, edit: EDIT_KIND.CROP } })
	})

	it("CAP-026-R14 deletes the new bytes and keeps the former content when the transaction fails", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }))
		const original = { ...run.files.received(FILE_A) }
		run.auditLog.failing = true

		await expect(run.replacements.replace(CURRENT, replacementOf(), NOW)).rejects.toThrow(/audit/)

		expect(run.files.byKey(FILE_A)).toMatchObject({
			binary_object_id: original.binary_object_id,
			sha256: original.sha256,
		})
		expect(run.binaries.discardedBytes).toEqual(["object-1", "object-2"])
		expect(run.binaries.removedRows).toEqual([])
		expect(run.binaries.recordedRows).toEqual([])
	})

	it("CAP-021-R29 deletes the new bytes of a replacement another request finished meanwhile", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }))
		run.files.received(FILE_A)
		run.transactions.beforeNextTransaction(() => {
			Object.assign(run.files.byKey(FILE_A) ?? {}, { sha256: sha256Of(CROPPED), edit_kind: EDIT_KIND.CROP })
		})

		const view = await run.replacements.replace(CURRENT, replacementOf(), NOW)

		expect(view.edit).toBe(EDIT_KIND.CROP)
		expect(run.binaries.discardedBytes).toEqual(["object-1", "object-2"])
		expect(run.audits).toEqual([])
	})

	it("merges a second edit of the same file into rotation and crop", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }))
		run.files.received(FILE_A, { edit_kind: EDIT_KIND.ROTATION })

		const view = await run.replacements.replace(CURRENT, replacementOf(), NOW)

		expect(view.edit).toBe(EDIT_KIND.ROTATION_AND_CROP)
	})

	it("CAP-021-R29 answers a repeated replacement with the same result", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION + 1 }))
		run.files.received(FILE_A, { sha256: sha256Of(CROPPED), edit_kind: EDIT_KIND.CROP })

		const view = await run.replacements.replace(CURRENT, replacementOf(), NOW)

		expect(view.edit).toBe(EDIT_KIND.CROP)
		expect(run.binaries.stored.size).toBe(0)
		expect(run.audits).toEqual([])
	})

	it("CAP-015-S56 answers the replacement of a file the server has not received as missing", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }))
		run.files.add({ file_key: FILE_A })

		const problem = await problemOf(run.replacements.replace(CURRENT, replacementOf(), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
		expect(problem.code).toBe(ERROR_CODE.RESOURCE_NOT_FOUND)
	})

	it("CAP-015-S52 refuses a replacement over another version", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION + 1 }))
		run.files.received(FILE_A)

		const problem = await problemOf(run.replacements.replace(CURRENT, replacementOf(), NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_VERSION_CONFLICT)
	})

	it("CAP-021-R07 refuses a replacement with Exif Orientation other than 1", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }))
		run.files.received(FILE_A)
		const rotated = jpegWith(8)

		const problem = await problemOf(
			run.replacements.replace(
				CURRENT,
				replacementOf({ sha256: sha256Of(rotated), content: plainContent(rotated) }),
				NOW,
			),
		)

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.RECEIVED)
	})

	it("ADR-015 refuses a replacement whose bytes differ from the declared sha256", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }))
		run.files.received(FILE_A)

		const problem = await problemOf(
			run.replacements.replace(CURRENT, replacementOf({ content: plainContent(jpegWith(1)) }), NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})
})

describe("order of the files of the draft record CAP-015-R33", () => {
	it("CAP-018-R11 renumbers the files in the requested order and audits the new order", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }))
		run.files.received(FILE_A)
		run.files.received(FILE_B)
		run.files.add({ file_key: FILE_C, status: FILE_STATUS.REJECTED })

		const view = await run.orders.reorder(
			CURRENT,
			{ acquisitionId: DRAFT_ID, version: VERSION, fileKeys: [FILE_C, FILE_A, FILE_B] },
			NOW,
		)

		expect(view).toMatchObject({ version: VERSION + 1 })
		expect([FILE_A, FILE_B, FILE_C].map((key) => run.files.byKey(key)?.sequence)).toEqual([2, 3, 1])
		expect(run.audits[0]?.eventType).toBe(AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_FILE_ORDER_CHANGED)
		expect(detailsOf(run.audits[0])).toMatchObject({ file_order: [FILE_C, FILE_A, FILE_B] })
	})

	it("CAP-021-R29 keeps the same order without a version check or audit", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION + 2 }))
		run.files.received(FILE_A)
		run.files.received(FILE_B)

		await run.orders.reorder(CURRENT, { acquisitionId: DRAFT_ID, version: VERSION, fileKeys: [FILE_A, FILE_B] }, NOW)

		expect(run.audits).toEqual([])
		expect(run.drafts.draft.version).toBe(VERSION + 2)
	})

	it("CAP-015-R35 refuses an order without a held file", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }))
		run.files.received(FILE_A)
		run.files.received(FILE_B)

		const problem = await problemOf(
			run.orders.reorder(CURRENT, { acquisitionId: DRAFT_ID, version: VERSION, fileKeys: [FILE_B] }, NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})

	it("CAP-018-S10 does not bring a removed page back from an older version", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION + 1 }))
		run.files.received(FILE_A)
		run.files.add({ file_key: FILE_B, status: FILE_STATUS.REMOVED })

		const problem = await problemOf(
			run.orders.reorder(CURRENT, { acquisitionId: DRAFT_ID, version: VERSION, fileKeys: [FILE_B, FILE_A] }, NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(run.files.byKey(FILE_B)?.status).toBe(FILE_STATUS.REMOVED)
	})

	it("CAP-015-S52 refuses a new order over another version", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION + 1 }))
		run.files.received(FILE_A)
		run.files.received(FILE_B)

		const problem = await problemOf(
			run.orders.reorder(CURRENT, { acquisitionId: DRAFT_ID, version: VERSION, fileKeys: [FILE_B, FILE_A] }, NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_VERSION_CONFLICT)
	})
})
