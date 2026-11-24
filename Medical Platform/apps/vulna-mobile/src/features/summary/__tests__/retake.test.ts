import type { BufferedFile } from "@ansora/core-mobile"
import { describe, expect, it, vi } from "vitest"
import cs from "../../../i18n/cs.json"
import { fileStateLabelOf, RETAKE, retakeInPlace, retakeOfCondition, retakeOfFile } from "../retake"
import { isOpenable, type RecordFile, recordFileCountOf } from "../shown-file"

vi.mock("@ansora/core-mobile", async () => ({
	...(await import("../../../../../../libs/core/mobile/src/storage/upload-status")),
	...(await import("../../../../../../libs/core/mobile/src/storage/transfer-buffer")),
}))

function file(fileKey: string, change: Partial<BufferedFile> = {}): BufferedFile {
	return {
		fileKey,
		acquisitionId: "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10",
		operatorUserId: "operator",
		position: 1,
		kind: "image",
		contentFileId: `${fileKey}-content`,
		thumbnailFileId: `${fileKey}-thumbnail`,
		originalFileId: null,
		corners: null,
		width: 1,
		height: 1,
		capturedAt: "2026-10-19T08:58:00.000Z",
		uploadState: "waiting",
		sentContentFileId: null,
		receivedContentFileId: null,
		contentEdit: null,
		rejectionCode: null,
		editFailedContentFileId: null,
		replacesFileKey: null,
		...change,
	}
}

describe("retake of a failed file", () => {
	it("CAP-015-R36 E112 asks for a new photo of a file the server rejected in an open record", () => {
		expect(retakeOfFile(file("a", { uploadState: "rejected", rejectionCode: "record-rejected" }))).toBe(RETAKE.REJECTED)
	})

	it("CAP-009-S05 Q-076 asks for a new photo of a file the device cannot read", () => {
		expect(retakeOfFile(file("a", { uploadState: "unreadable" }))).toBe(RETAKE.UNREADABLE)
	})

	it("CAP-019-S18 E113 does not ask for a new photo of a decided record", () => {
		expect(retakeOfFile(file("a", { uploadState: "rejected", rejectionCode: "acquisition-already-decided" }))).toBe(
			undefined,
		)
	})

	it("CAP-015-R35 asks for nothing while a file waits on another device", () => {
		expect(retakeOfCondition("on_other_device")).toBeUndefined()
		expect(retakeOfCondition("kept")).toBeUndefined()
	})

	it("CAP-015-R35 E111 E112 Q-076 names the state of a failed or waiting file and nothing for a kept one", () => {
		expect(fileStateLabelOf("rejected", cs)).toBe("Server tento soubor nepřijal")
		expect(fileStateLabelOf("unreadable", cs)).toBe("Tento soubor nejde přečíst")
		expect(fileStateLabelOf("on_other_device", cs)).toBe("Tento soubor čeká na jiném zařízení")
		expect(fileStateLabelOf("kept", cs)).toBeUndefined()
	})

	it("CAP-015-R36 CAP-019-S12 puts the new photo in place of a rejected one without removing it first", async () => {
		const removeFirst = vi.fn(async () => true)
		const openCamera = vi.fn()

		await retakeInPlace(RETAKE.REJECTED, "a", removeFirst, openCamera)

		expect(removeFirst).not.toHaveBeenCalled()
		expect(openCamera).toHaveBeenCalledWith("a")
	})

	it("CAP-009-S05 Q-076 removes an unreadable photo first and adds the new one", async () => {
		const openCamera = vi.fn()

		await retakeInPlace(RETAKE.UNREADABLE, "a", async () => true, openCamera)

		expect(openCamera).toHaveBeenCalledWith(undefined)
	})

	it("CAP-015-R18 opens no camera when the unreadable photo could not be removed", async () => {
		const openCamera = vi.fn()

		await retakeInPlace(RETAKE.UNREADABLE, "a", async () => false, openCamera)

		expect(openCamera).not.toHaveBeenCalled()
	})
})

describe("files of the record in the summary", () => {
	const server = [
		{ file_key: "a", sequence: 1, status: "received" as const },
		{ file_key: "x", sequence: 2, status: "rejected" as const },
	]

	it("CAP-015-R18 CAP-015-R36 opens a photo of the phone and a failed photo only the server has", () => {
		const kept = { kind: "server", fileKey: "a", condition: "kept" } as RecordFile
		const rejected = { kind: "server", fileKey: "x", condition: "rejected" } as RecordFile
		const local = { kind: "local", fileKey: "b", condition: "kept" } as RecordFile

		expect([kept, rejected, local].map(isOpenable)).toEqual([false, true, true])
	})

	it("CAP-015-R13 CAP-015-R36 counts the files of the record without the one a retake replaces", () => {
		expect(recordFileCountOf([], server, undefined)).toBe(2)
		expect(recordFileCountOf([], server, "x")).toBe(1)
	})
})
