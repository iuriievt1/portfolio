import { ERROR_CODE } from "@ansora/contracts"
import type { BufferedFile, QueuedClosure } from "@ansora/core-mobile"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NodeSqlDatabase } from "../../../../../../libs/core/mobile/src/storage/__tests__/node-sql-database"
import { openEncryptedDatabase } from "../../../../../../libs/core/mobile/src/storage/encrypted-database"
import { SqlQueueNoticeRecords } from "../../../../../../libs/core/mobile/src/storage/queue-notice"
import { SerialSqlDatabase } from "../../../../../../libs/core/mobile/src/storage/sql-database"
import { forgetFileNotice, noteRejectedFile, noteSlowedFile, noteUnreadableFile, noticesOf } from "../queue-notices"

const ACQUISITION = "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10"
const OPERATOR = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
const OTHER_USER = "6e7f8a9b-0c1d-4e2f-8a3b-4c5d6e7f8a9b"
const DATABASE_KEY = "ab".repeat(32)
const NOW = new Date("2026-10-19T09:10:00.000Z")
const CAPTURED_AT = "2026-10-19T08:58:00.000Z"

const world = vi.hoisted(() => ({
	notices: undefined as unknown as SqlQueueNoticeRecords,
}))

vi.mock("@ansora/core-mobile", async () => ({
	...(await import("../../../../../../libs/core/mobile/src/storage/upload-status")),
	...(await import("../../../../../../libs/core/mobile/src/storage/transfer-buffer")),
	...(await import("../../../../../../libs/core/mobile/src/storage/queue-notice")),
}))
vi.mock("../transfer-store", () => ({
	queueNotices: async () => world.notices,
}))

function file(change: Partial<BufferedFile> = {}): BufferedFile {
	return {
		fileKey: "a",
		acquisitionId: ACQUISITION,
		operatorUserId: OPERATOR,
		position: 1,
		kind: "image",
		contentFileId: "a-content",
		thumbnailFileId: "a-thumbnail",
		originalFileId: null,
		corners: null,
		width: 1,
		height: 1,
		capturedAt: CAPTURED_AT,
		uploadState: "rejected",
		sentContentFileId: "a-content",
		receivedContentFileId: null,
		contentEdit: null,
		rejectionCode: null,
		editFailedContentFileId: null,
		replacesFileKey: null,
		...change,
	}
}

const QUEUED_CLOSURE: QueuedClosure = {
	acquisitionId: ACQUISITION,
	operatorUserId: OPERATOR,
	operatorPersonalNumber: "12345",
	recordKind: "photo",
	fileKeys: ["a", "b"],
	contentFingerprint: "content-1",
	completedAt: "2026-10-19T09:00:00.000Z",
}

beforeEach(async () => {
	const db = new SerialSqlDatabase(
		await openEncryptedDatabase("queue", DATABASE_KEY, "/vault/queue", async () => new NodeSqlDatabase()),
	)
	world.notices = new SqlQueueNoticeRecords(db)
})

describe("notices of the queue for the operator CAP-019-R25", () => {
	it("CAP-019-S10 notes a refused file of an open record for its operator, with the moment it was taken", async () => {
		await noteRejectedFile(file(), ERROR_CODE.RECORD_REJECTED, undefined, NOW)

		expect(await noticesOf(OPERATOR)).toEqual([
			{
				id: "file:a",
				kind: "file_rejected",
				operatorUserId: OPERATOR,
				acquisitionId: ACQUISITION,
				recordKind: "photo",
				capturedAt: CAPTURED_AT,
				rejectionCode: ERROR_CODE.RECORD_REJECTED,
				createdAt: NOW.toISOString(),
			},
		])
		expect(await noticesOf(OTHER_USER)).toEqual([])
	})

	it("CAP-019-R29 E114 turns a refused file of a queued closure into one notice that the record was not closed", async () => {
		await noteSlowedFile(file(), NOW)

		await noteRejectedFile(file(), ERROR_CODE.RECORD_REJECTED, QUEUED_CLOSURE, NOW)

		expect(await noticesOf(OPERATOR)).toMatchObject([{ id: `closure:${ACQUISITION}`, kind: "closure_file_rejected" }])
	})

	it("CAP-019-S18 E113 notes that the file of a decided record was not used, not that the record was not closed", async () => {
		await noteRejectedFile(file(), ERROR_CODE.ACQUISITION_ALREADY_DECIDED, QUEUED_CLOSURE, NOW)

		expect(await noticesOf(OPERATOR)).toMatchObject([
			{ kind: "file_rejected", rejectionCode: ERROR_CODE.ACQUISITION_ALREADY_DECIDED },
		])
	})

	it("CAP-009-S05 Q-076 notes a file the device cannot read for its operator", async () => {
		await noteUnreadableFile(file({ uploadState: "unreadable" }), undefined, NOW)

		expect(await noticesOf(OPERATOR)).toMatchObject([
			{ id: "file:a", kind: "file_unreadable", capturedAt: CAPTURED_AT, rejectionCode: null },
		])
	})

	it("CAP-009-S05 CAP-019-R29 E114 Q-076 turns an unreadable file of a queued closure into one notice", async () => {
		await noteSlowedFile(file(), NOW)

		await noteUnreadableFile(file({ uploadState: "unreadable" }), QUEUED_CLOSURE, NOW)

		expect(await noticesOf(OPERATOR)).toMatchObject([{ id: `closure:${ACQUISITION}`, kind: "closure_file_unreadable" }])
	})

	it("CAP-019-R18 notes a slowed upload once and forgets it when the server receives the file", async () => {
		await noteSlowedFile(file({ kind: "document_page", uploadState: "waiting" }), NOW)
		await noteSlowedFile(file({ kind: "document_page", uploadState: "waiting" }), NOW)

		expect(await noticesOf(OPERATOR)).toMatchObject([{ kind: "file_slowed", recordKind: "scan" }])

		await forgetFileNotice("a")

		expect(await noticesOf(OPERATOR)).toEqual([])
	})
})
