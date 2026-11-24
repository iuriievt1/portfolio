import { type BufferedFile, needsReplacement, UPLOAD_STATE } from "@ansora/core-mobile"
import { describe, expect, it, vi } from "vitest"
import { queueReportOf } from "../queue-report"
import { awaitedRecordsOf, receiptReconciliationsOf } from "../server-receipts"

vi.mock("@ansora/core-mobile", async () => ({
	...(await import("../../../../../../libs/core/mobile/src/storage/upload-status")),
	...(await import("../../../../../../libs/core/mobile/src/storage/transfer-buffer")),
}))

const RECORD = "record"
const OTHER_RECORD = "other-record"
const DETECTED_AT = new Date("2026-10-16T12:00:00.000Z")

function file(fileKey: string, change: Partial<BufferedFile> = {}): BufferedFile {
	return {
		fileKey,
		acquisitionId: RECORD,
		operatorUserId: "nurse-a",
		position: 1,
		kind: "image",
		contentFileId: `${fileKey}-content`,
		thumbnailFileId: `${fileKey}-thumbnail`,
		originalFileId: null,
		corners: null,
		width: 1,
		height: 1,
		capturedAt: "2026-10-16T07:18:00.000Z",
		uploadState: UPLOAD_STATE.WAITING,
		sentContentFileId: null,
		receivedContentFileId: null,
		contentEdit: null,
		rejectionCode: null,
		editFailedContentFileId: null,
		replacesFileKey: null,
		...change,
	}
}

function state(acquisitionId: string, receivedFileKeys: string[]) {
	return {
		idempotency_key: acquisitionId,
		acquisition_id: acquisitionId,
		state: "draft" as const,
		received_file_keys: receivedFileKeys,
	}
}

describe("report of the queue on the device CAP-019-R08", () => {
	it("Q-076 counts the waiting and the failed files of every user and the oldest of them, never the received ones", () => {
		const report = queueReportOf(
			[
				file("a", { capturedAt: "2026-10-16T08:00:00.000Z" }),
				file("b", { operatorUserId: "nurse-b", uploadState: UPLOAD_STATE.UPLOADING }),
				file("c", { uploadState: UPLOAD_STATE.REJECTED, capturedAt: "2026-10-15T06:00:00.000Z" }),
				file("e", { uploadState: UPLOAD_STATE.UNREADABLE, capturedAt: "2026-10-15T07:00:00.000Z" }),
				file("d", {
					uploadState: UPLOAD_STATE.RECEIVED,
					receivedContentFileId: "d-content",
					capturedAt: "2026-10-01T06:00:00.000Z",
				}),
			],
			DETECTED_AT,
		)

		expect(report).toEqual({
			waiting: 2,
			failed: 2,
			oldest_acquired_at: "2026-10-15T06:00:00.000Z",
			detected_at: DETECTED_AT.toISOString(),
		})
	})

	it("CAP-007-S08 reports an empty queue with no oldest item", () => {
		expect(queueReportOf([], DETECTED_AT)).toEqual({
			waiting: 0,
			failed: 0,
			oldest_acquired_at: null,
			detected_at: DETECTED_AT.toISOString(),
		})
	})
})

describe("files the server already received CAP-019-R24", () => {
	it("asks only about records that still have a file waiting", () => {
		const files = [file("a"), file("b", { acquisitionId: OTHER_RECORD, uploadState: UPLOAD_STATE.REJECTED })]

		expect([...awaitedRecordsOf(files)]).toEqual([RECORD])
	})

	it("CAP-019-R12 takes as received only the waiting files the server lists, of the records the device waits for", () => {
		const files = [file("a"), file("b"), file("c", { acquisitionId: OTHER_RECORD, uploadState: UPLOAD_STATE.RECEIVED })]

		const changes = receiptReconciliationsOf(files, [state(RECORD, ["a"]), state(OTHER_RECORD, ["c"])])

		expect(changes).toEqual([{ kind: "received", fileKey: "a", contentFileId: "a-content" }])
	})

	it("CAP-015-R34 keeps sending an edit made after the original was sent", () => {
		const edited = file("a", { contentFileId: "a-turned", sentContentFileId: "a-content" })

		const [change] = receiptReconciliationsOf([edited], [state(RECORD, ["a"])])
		const afterReceipt = {
			...edited,
			uploadState: UPLOAD_STATE.RECEIVED,
			receivedContentFileId: change?.kind === "received" ? change.contentFileId : null,
		}

		expect(change).toEqual({ kind: "received", fileKey: "a", contentFileId: "a-content" })
		expect(needsReplacement(afterReceipt)).toBe(true)
	})
})
