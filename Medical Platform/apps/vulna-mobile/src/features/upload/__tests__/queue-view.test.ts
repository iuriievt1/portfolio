import { ACQUISITION_KIND } from "@ansora/contracts"
import { type BufferedFile, UPLOAD_STATE } from "@ansora/core-mobile"
import { describe, expect, it, vi } from "vitest"
import cs from "../../../i18n/cs.json"
import { othersQueueTextOf, queuedRecordDetailOf, queuedRecordStatusOf } from "../queue-text"
import { queueViewOf } from "../queue-view"

vi.mock("@ansora/core-mobile", async () => ({
	...(await import("../../../../../../libs/core/mobile/src/storage/upload-status")),
	...(await import("../../../../../../libs/core/mobile/src/storage/transfer-buffer")),
}))

const NURSE = "nurse-a"
const COLLEAGUE = "nurse-b"
const NOW = new Date("2026-10-16T12:00:00.000Z")

function file(fileKey: string, change: Partial<BufferedFile> = {}): BufferedFile {
	return {
		fileKey,
		acquisitionId: "wound",
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

const received = { uploadState: UPLOAD_STATE.RECEIVED, receivedContentFileId: "x-content", contentFileId: "x-content" }

describe("state of the queue on the device CAP-019-R08", () => {
	it("shows one own row per record with what still uploads, oldest first", () => {
		const view = queueViewOf(
			[
				file("scan-1", { acquisitionId: "document", kind: "document_page", capturedAt: "2026-10-16T09:00:00.000Z" }),
				file("a", { capturedAt: "2026-10-16T07:20:00.000Z" }),
				file("b", { uploadState: UPLOAD_STATE.UPLOADING }),
				file("c", { ...received }),
			],
			NURSE,
		)

		expect(view.own).toEqual([
			{
				acquisitionId: "wound",
				operatorUserId: NURSE,
				kind: ACQUISITION_KIND.PHOTO,
				awaitingCount: 2,
				failedCount: 0,
				capturedAt: new Date("2026-10-16T07:18:00.000Z"),
			},
			{
				acquisitionId: "document",
				operatorUserId: NURSE,
				kind: ACQUISITION_KIND.SCAN,
				awaitingCount: 1,
				failedCount: 0,
				capturedAt: new Date("2026-10-16T09:00:00.000Z"),
			},
		])
	})

	it("CAP-019-R24 leaves out a record the server has whole", () => {
		const view = queueViewOf([file("a", { ...received }), file("b", { ...received })], NURSE)

		expect(view.own).toEqual([])
	})

	it("CAP-019-R14 keeps a record whose file the server refused and says it failed", () => {
		const view = queueViewOf([file("a", { uploadState: UPLOAD_STATE.REJECTED }), file("b", { ...received })], NURSE)
		const [failed] = view.own

		expect(failed).toMatchObject({ awaitingCount: 0, failedCount: 1 })
		expect(failed && queuedRecordStatusOf(failed, cs)).toEqual({ tone: "warn", label: "Selhalo" })
		expect(failed && queuedRecordDetailOf(failed, NOW, cs)).toMatch(/^1 snímek · dnes /)
	})

	it("CAP-009-S05 Q-076 keeps a record whose file the device cannot read and says it failed", () => {
		const [failed] = queueViewOf([file("a", { uploadState: UPLOAD_STATE.UNREADABLE })], NURSE).own

		expect(failed).toMatchObject({ awaitingCount: 0, failedCount: 1 })
		expect(failed && queuedRecordStatusOf(failed, cs)).toEqual({ tone: "warn", label: "Selhalo" })
	})

	it("says how many own images still upload and when the record was taken", () => {
		const [uploading] = queueViewOf([file("a"), file("b")], NURSE).own

		expect(uploading && queuedRecordStatusOf(uploading, cs)).toEqual({ tone: "info", label: "Nahrává se" })
		expect(uploading && queuedRecordDetailOf(uploading, NOW, cs)).toMatch(/^2 snímky · dnes /)
	})

	it("CAP-019-R23 CAP-019-S08 shows the records of another user only by their number and state", () => {
		const view = queueViewOf(
			[
				file("a", { operatorUserId: COLLEAGUE, acquisitionId: "first" }),
				file("b", { operatorUserId: COLLEAGUE, acquisitionId: "second" }),
				file("c", { operatorUserId: COLLEAGUE, acquisitionId: "third", uploadState: UPLOAD_STATE.REJECTED }),
			],
			NURSE,
		)

		expect(view.own).toEqual([])
		expect(view.others).toEqual({ recordCount: 3, failedRecordCount: 1 })
		expect(othersQueueTextOf(view.others, cs)).toEqual({
			label: "3 záznamy jiného uživatele",
			detail: "z toho 1 selhal",
		})
	})

	it("says the records of another user wait when none of them failed", () => {
		const view = queueViewOf([file("a", { operatorUserId: COLLEAGUE })], NURSE)

		expect(othersQueueTextOf(view.others, cs)).toEqual({
			label: "1 záznam jiného uživatele",
			detail: "čeká na odeslání",
		})
	})
})
