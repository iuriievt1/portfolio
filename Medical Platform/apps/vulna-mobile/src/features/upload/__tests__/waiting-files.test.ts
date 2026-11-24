import { type BufferedFile, UPLOAD_STATE, type UploadState } from "@ansora/core-mobile"
import { describe, expect, it, vi } from "vitest"
import { isQueueFull, ownAwaitingFileCountOf, waitingFileCountOf } from "../waiting-files"

vi.mock("@ansora/core-mobile", async () => ({
	...(await import("../../../../../../libs/core/mobile/src/storage/upload-status")),
	...(await import("../../../../../../libs/core/mobile/src/storage/transfer-buffer")),
}))

const QUEUE_LIMIT = 10
const NURSE = "nurse-a"
const COLLEAGUE = "nurse-b"

function filesIn(state: UploadState, count: number): { uploadState: UploadState }[] {
	return Array.from({ length: count }, () => ({ uploadState: state }))
}

function file(fileKey: string, change: Partial<BufferedFile> = {}): BufferedFile {
	return {
		fileKey,
		acquisitionId: "record",
		operatorUserId: NURSE,
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

describe("files waiting on the device CAP-012-R25", () => {
	it("counts the files that still wait or upload and not those the server received or refused", () => {
		const files = [
			{ uploadState: UPLOAD_STATE.WAITING },
			{ uploadState: UPLOAD_STATE.UPLOADING },
			{ uploadState: UPLOAD_STATE.RECEIVED },
			{ uploadState: UPLOAD_STATE.REJECTED },
		]

		expect(waitingFileCountOf(files)).toBe(2)
	})
})

describe("limit of the queue on the device CAP-019-R17", () => {
	it("CAP-019-S13 Q-076 does not count failed files, so they do not fill the queue", () => {
		const files = [
			...filesIn(UPLOAD_STATE.REJECTED, 4),
			...filesIn(UPLOAD_STATE.UNREADABLE, 4),
			...filesIn(UPLOAD_STATE.WAITING, 2),
		]

		expect(isQueueFull(files, QUEUE_LIMIT)).toBe(false)
	})

	it("E24 says the queue is full once the waiting and uploading files reach the limit", () => {
		const files = [...filesIn(UPLOAD_STATE.WAITING, 6), ...filesIn(UPLOAD_STATE.UPLOADING, 4)]

		expect(isQueueFull(files, QUEUE_LIMIT)).toBe(true)
	})

	it("sets no limit until the configuration is known", () => {
		expect(isQueueFull(filesIn(UPLOAD_STATE.WAITING, QUEUE_LIMIT), undefined)).toBe(false)
	})
})

describe("own files the server has not received yet CAP-002-R14", () => {
	it("CAP-002-S12 counts the own files that still wait or upload", () => {
		const files = [file("a"), file("b", { uploadState: UPLOAD_STATE.UPLOADING })]

		expect(ownAwaitingFileCountOf(files, NURSE)).toBe(2)
	})

	it("CAP-002-S13 does not count the files of another user", () => {
		const files = [file("a", { operatorUserId: COLLEAGUE }), file("b", { operatorUserId: COLLEAGUE })]

		expect(ownAwaitingFileCountOf(files, NURSE)).toBe(0)
	})

	it("CAP-019-R14 does not count an own file the server refused, because it will not be sent again", () => {
		expect(ownAwaitingFileCountOf([file("a", { uploadState: UPLOAD_STATE.REJECTED })], NURSE)).toBe(0)
	})

	it("CAP-009-S05 Q-076 does not count an own file the device cannot read, because it will never be sent", () => {
		expect(ownAwaitingFileCountOf([file("a", { uploadState: UPLOAD_STATE.UNREADABLE })], NURSE)).toBe(0)
	})

	it("CAP-019-R24 does not count a file the server confirmed", () => {
		const received = file("a", { uploadState: UPLOAD_STATE.RECEIVED, receivedContentFileId: "a-content" })

		expect(ownAwaitingFileCountOf([received], NURSE)).toBe(0)
	})

	it("CAP-015-R34 counts a received file whose edit the server has not received yet", () => {
		const edited = file("a", {
			uploadState: UPLOAD_STATE.RECEIVED,
			contentFileId: "a-turned",
			receivedContentFileId: "a-content",
		})

		expect(ownAwaitingFileCountOf([edited], NURSE)).toBe(1)
	})
})
