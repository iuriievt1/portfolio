import { ACQUISITION_KIND, ERROR_CODE } from "@ansora/contracts"
import { MILLISECONDS_PER_SECOND, sha256Hex } from "@ansora/core-server"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { Device } from "../../device/types/device.types"
import {
	acquisitionRow,
	DEVICE,
	NOW,
	OTHER_USER,
	problemOf,
	SESSION,
	USER,
} from "../../encounter/__tests__/encounter-fixtures"
import { FILE_KIND, FILE_STATUS } from "../constants/acquisition-file.constants"
import { QUEUE_SENDER } from "../constants/queue-sender.constants"
import type { FileAnnouncement } from "../types/acquisition-file.types"
import type { QueueSender } from "../types/queue-sender.types"
import {
	DRAFT_ID,
	FILE_A,
	FILE_B,
	FILE_C,
	fileHarness,
	MAX_IMAGES,
	PERMISSION_LIFETIME_SECONDS,
	sha256Of,
	USER_SENDER,
} from "./acquisition-file-fixtures"

const FINGERPRINT = sha256Of(Buffer.from("announced bytes"))
const PERMISSION_EXPIRES_AT = new Date(NOW.getTime() + PERMISSION_LIFETIME_SECONDS * MILLISECONDS_PER_SECOND)
const DEVICE_SENDER: QueueSender = {
	kind: QUEUE_SENDER.DEVICE,
	device: { id: DEVICE } as Device,
	operatorUserId: USER,
}

function announcementOf(overrides: Partial<FileAnnouncement> = {}): FileAnnouncement {
	return {
		acquisitionId: DRAFT_ID,
		fileKey: FILE_C,
		fileKind: FILE_KIND.IMAGE,
		sha256: FINGERPRINT,
		proposedSequence: 3,
		replacesFileKey: undefined,
		...overrides,
	}
}

describe("file announced before its upload CAP-015-R35", () => {
	it("appends the file after the files the server holds and raises the version", async () => {
		const run = fileHarness()
		run.files.received(FILE_A)
		run.files.received(FILE_B)

		const result = await run.announcements.announce(USER_SENDER, announcementOf(), NOW)

		expect(result.created).toBe(true)
		expect(result.file).toMatchObject({ file_key: FILE_C, sequence: 3, status: FILE_STATUS.ANNOUNCED })
		expect(run.files.byKey(FILE_C)).toMatchObject({ announced_by_device_id: DEVICE, proposed_sequence: 3 })
		expect(run.drafts.draft.version).toBe(2)
	})

	it("CAP-021-S22 keeps the order of announcement, not the proposed sequence", async () => {
		const run = fileHarness()
		run.files.received(FILE_A)

		const result = await run.announcements.announce(USER_SENDER, announcementOf({ proposedSequence: 1 }), NOW)

		expect(result.file.sequence).toBe(2)
		expect(run.files.byKey(FILE_A)?.sequence).toBe(1)
	})

	it("CAP-021-R29 answers a repeated announcement with the same file and changes nothing", async () => {
		const run = fileHarness()
		await run.announcements.announce(USER_SENDER, announcementOf(), NOW)

		const repeated = await run.announcements.announce(USER_SENDER, announcementOf(), NOW)

		expect(repeated.created).toBe(false)
		expect(repeated.file.file_key).toBe(FILE_C)
		expect(run.files.rows).toHaveLength(1)
		expect(run.drafts.draft.version).toBe(2)
	})

	it("CAP-021-R29 refuses the same file key with another announcement", async () => {
		const run = fileHarness()
		await run.announcements.announce(USER_SENDER, announcementOf(), NOW)

		const problem = await problemOf(
			run.announcements.announce(USER_SENDER, announcementOf({ proposedSequence: 7 }), NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.IDEMPOTENCY_CONFLICT)
	})

	it("CAP-019-S19 refuses a file the operator removed", async () => {
		const run = fileHarness()
		run.files.add({ file_key: FILE_C, status: FILE_STATUS.REMOVED, proposed_sequence: 3 })

		const problem = await problemOf(run.announcements.announce(USER_SENDER, announcementOf(), NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_ALREADY_DECIDED)
	})

	it("CAP-019-R14 refuses a file of a closed record", async () => {
		const run = fileHarness(acquisitionRow({ state: ACQUISITION_STATE.RECEIVED, closed_at: NOW, file_count: 2 }))

		const problem = await problemOf(run.announcements.announce(USER_SENDER, announcementOf(), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_ALREADY_DECIDED)
	})

	it("CAP-021-R23 answers a late repeat of an announcement into a closed record with the same file", async () => {
		const closed = acquisitionRow({ state: ACQUISITION_STATE.RECEIVED, closed_at: NOW, file_count: 1, version: 3 })
		const run = fileHarness(closed)
		run.files.received(FILE_C, { proposed_sequence: 3, sequence: 1 })

		const repeated = await run.announcements.announce(USER_SENDER, announcementOf(), NOW)

		expect(repeated.created).toBe(false)
		expect(repeated.file).toMatchObject({ file_key: FILE_C, status: FILE_STATUS.RECEIVED, sequence: 1 })
		expect(run.drafts.draft.version).toBe(3)
	})

	it("CAP-019-S18 refuses a file of a discarded record", async () => {
		const run = fileHarness()
		run.drafts.rows.clear()
		run.drafts.decided.set(DRAFT_ID, "discarded")

		const problem = await problemOf(run.announcements.announce(USER_SENDER, announcementOf(), NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_ALREADY_DECIDED)
	})

	it("answers an unknown record as missing", async () => {
		const run = fileHarness()
		run.drafts.rows.clear()

		const problem = await problemOf(run.announcements.announce(USER_SENDER, announcementOf(), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})

	it("CAP-015-R17 answers a record of another operator as missing", async () => {
		const run = fileHarness(acquisitionRow({ operator_user_id: OTHER_USER }))

		const problem = await problemOf(run.announcements.announce(USER_SENDER, announcementOf(), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})

	it("refuses a page in a photo record", async () => {
		const run = fileHarness()

		const problem = await problemOf(
			run.announcements.announce(USER_SENDER, announcementOf({ fileKind: FILE_KIND.DOCUMENT_PAGE }), NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})

	it("CAP-019-S12 puts the replacement of a rejected file in its place", async () => {
		const run = fileHarness()
		run.files.received(FILE_A)
		run.files.add({ file_key: FILE_B, status: FILE_STATUS.REJECTED })

		const result = await run.announcements.announce(USER_SENDER, announcementOf({ replacesFileKey: FILE_B }), NOW)

		expect(result.file.sequence).toBe(2)
		expect(run.files.byKey(FILE_B)?.status).toBe(FILE_STATUS.REMOVED)
		expect(run.files.byKey(FILE_C)?.replaces_file_id).toBe(run.files.byKey(FILE_B)?.id)
	})

	it("CAP-015-R36 refuses to replace a file that was not rejected", async () => {
		const run = fileHarness()
		run.files.received(FILE_B)

		const problem = await problemOf(
			run.announcements.announce(USER_SENDER, announcementOf({ replacesFileKey: FILE_B }), NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})

	it("CAP-015-R13 refuses a file over the limit of the record", async () => {
		const run = fileHarness()
		for (let index = 0; index < MAX_IMAGES; index++) {
			run.files.received(`b1000000-0000-4000-8000-${String(index).padStart(12, "0")}`)
		}

		const problem = await problemOf(run.announcements.announce(USER_SENDER, announcementOf(), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.PAYLOAD_TOO_LARGE)
	})

	it("CAP-015-S61 keeps every file of a record over a lowered limit and refuses a further one", async () => {
		const run = fileHarness()
		const kept = Array.from(
			{ length: MAX_IMAGES + 1 },
			(_, index) => `b1000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
		)
		for (const fileKey of kept) {
			run.files.received(fileKey)
		}

		const problem = await problemOf(run.announcements.announce(USER_SENDER, announcementOf(), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.PAYLOAD_TOO_LARGE)
		expect(run.files.rows.map((row) => row.file_key)).toEqual(kept)
	})

	it("CAP-018-S12 keeps every page of a document over a lowered limit and refuses a further one", async () => {
		const run = fileHarness(acquisitionRow({ kind: ACQUISITION_KIND.SCAN }))
		const kept = Array.from(
			{ length: MAX_IMAGES + 1 },
			(_, index) => `c1000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
		)
		for (const fileKey of kept) {
			run.files.received(fileKey, { kind: ACQUISITION_KIND.SCAN })
		}

		const problem = await problemOf(
			run.announcements.announce(USER_SENDER, announcementOf({ fileKind: FILE_KIND.DOCUMENT_PAGE }), NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.PAYLOAD_TOO_LARGE)
		expect(run.files.rows.map((row) => row.file_key)).toEqual(kept)
	})
})

// ADR-014
describe("upload permission issued at the announcement CAP-019-R01", () => {
	it("binds the permission to the device, the record, the file and its fingerprint for the configured time", async () => {
		const run = fileHarness()

		const result = await run.announcements.announce(USER_SENDER, announcementOf(), NOW)

		expect(result.permission.expiresAt).toEqual(PERMISSION_EXPIRES_AT)
		expect(await run.permissions.find(result.permission.token, NOW)).toEqual({
			acquisitionId: DRAFT_ID,
			fileKey: FILE_C,
			deviceId: DEVICE,
			senderSession: { sessionId: SESSION, userId: USER },
			sha256: FINGERPRINT,
		})
	})

	it("keeps only the hash of the permission", async () => {
		const run = fileHarness()

		const result = await run.announcements.announce(USER_SENDER, announcementOf(), NOW)

		expect([...run.permissionRows.rows.keys()]).toEqual([sha256Hex(result.permission.token)])
	})

	it("voids the previous permission of the file when the file is announced again", async () => {
		const run = fileHarness()
		const first = await run.announcements.announce(USER_SENDER, announcementOf(), NOW)

		const repeated = await run.announcements.announce(USER_SENDER, announcementOf(), NOW)

		expect(repeated.created).toBe(false)
		expect(await run.permissions.find(first.permission.token, NOW)).toBeUndefined()
		expect(await run.permissions.find(repeated.permission.token, NOW)).toMatchObject({ fileKey: FILE_C })
	})

	it("refuses the permission once its time is over", async () => {
		const run = fileHarness()

		const result = await run.announcements.announce(USER_SENDER, announcementOf(), NOW)

		expect(await run.permissions.find(result.permission.token, PERMISSION_EXPIRES_AT)).toBeUndefined()
	})

	it("issues no permission when the announcement is refused", async () => {
		const run = fileHarness(acquisitionRow({ operator_user_id: OTHER_USER }))

		await problemOf(run.announcements.announce(USER_SENDER, announcementOf(), NOW))

		expect(run.permissionRows.rows.size).toBe(0)
	})
})

// CAP-002-R09
describe("announcement under the device token CAP-002-S33", () => {
	it("announces a file into the record of the operator the queue item carries", async () => {
		const run = fileHarness()

		const result = await run.announcements.announce(DEVICE_SENDER, announcementOf(), NOW)

		expect(result.created).toBe(true)
		expect(run.files.byKey(FILE_C)).toMatchObject({ announced_by_device_id: DEVICE })
		expect(await run.permissions.find(result.permission.token, NOW)).toMatchObject({
			deviceId: DEVICE,
			senderSession: undefined,
		})
	})

	it("refuses a record of another operator than the queue item carries", async () => {
		const run = fileHarness(acquisitionRow({ operator_user_id: OTHER_USER }))

		const problem = await problemOf(run.announcements.announce(DEVICE_SENDER, announcementOf(), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.FORBIDDEN)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(run.files.byKey(FILE_C)).toBeUndefined()
	})

	it("CAP-019-S18 refuses a new file in a closed record", async () => {
		const run = fileHarness(acquisitionRow({ state: ACQUISITION_STATE.RECEIVED, closed_at: NOW, file_count: 1 }))

		const problem = await problemOf(run.announcements.announce(DEVICE_SENDER, announcementOf(), NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_ALREADY_DECIDED)
		expect(run.permissionRows.rows.size).toBe(0)
	})
})
