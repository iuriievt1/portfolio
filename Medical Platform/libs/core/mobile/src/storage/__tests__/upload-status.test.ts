import { describe, expect, it } from "vitest"
import { type BufferedFile, UPLOAD_STATE } from "../transfer-buffer"
import {
	FILE_CONDITION,
	isUploaded,
	RECORD_FILES,
	REJECTION,
	reconciliationsOf,
	recordFilesStateOf,
	rejectionOf,
	removedElsewhereOf,
	SHOWN_FILE,
	serverOrderOf,
	shownFilesOf,
	UPLOAD_STEP,
	uploadStepOf,
} from "../upload-status"

function file(fileKey: string, change: Partial<BufferedFile> = {}): BufferedFile {
	return {
		fileKey,
		acquisitionId: "series",
		operatorUserId: "operator",
		position: 1,
		kind: "image",
		contentFileId: `${fileKey}-content`,
		thumbnailFileId: `${fileKey}-thumbnail`,
		originalFileId: null,
		corners: null,
		width: 1,
		height: 1,
		capturedAt: "2026-10-08T09:00:00.000Z",
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

describe("isUploaded", () => {
	it("CAP-015-R34 does not count a received file whose edit the server does not have yet", () => {
		const turned = file("a", { uploadState: UPLOAD_STATE.RECEIVED, receivedContentFileId: "a-original" })

		expect(isUploaded(turned)).toBe(false)
	})

	it("CAP-015-R34 E115 counts a received file whose edit the server refused", () => {
		const refused = file("a", {
			uploadState: UPLOAD_STATE.RECEIVED,
			receivedContentFileId: "a-original",
			editFailedContentFileId: "a-content",
		})

		expect(isUploaded(refused)).toBe(true)
	})
})

describe("shownFilesOf", () => {
	const received = (fileKey: string) =>
		file(fileKey, { uploadState: UPLOAD_STATE.RECEIVED, receivedContentFileId: `${fileKey}-content` })

	it("CAP-019-S18 E113 leaves a file of a decided record out of the record", () => {
		const decided = file("b", { uploadState: UPLOAD_STATE.REJECTED, rejectionCode: "acquisition-already-decided" })

		expect(shownFilesOf([received("a"), decided], []).map((shown) => shown.fileKey)).toEqual(["a"])
	})

	it("CAP-015-R36 E112 asks for a new photo of a file the server rejected, known on the phone or only on the server", () => {
		const rejectedHere = file("a", { uploadState: UPLOAD_STATE.REJECTED, rejectionCode: "record-rejected" })
		const server = [
			{ file_key: "b", sequence: 2, status: "rejected" as const },
			{ file_key: "c", sequence: 3, status: "rejected" as const },
		]

		expect(shownFilesOf([rejectedHere, file("b")], server).map((shown) => shown.condition)).toEqual([
			FILE_CONDITION.REJECTED,
			FILE_CONDITION.REJECTED,
			FILE_CONDITION.REJECTED,
		])
	})

	it("CAP-009-S05 Q-076 asks for a new photo of an unreadable file and of a file the phone lost", () => {
		const unreadable = file("b", { uploadState: UPLOAD_STATE.UNREADABLE })
		const lost = { file_key: "a", sequence: 1, status: "announced" as const, pending_on_other_device: false }

		expect(shownFilesOf([unreadable], [lost])).toMatchObject([
			{ kind: SHOWN_FILE.SERVER, fileKey: "a", condition: FILE_CONDITION.UNREADABLE },
			{ kind: SHOWN_FILE.LOCAL, fileKey: "b", condition: FILE_CONDITION.UNREADABLE },
		])
	})

	it("CAP-019-R24 Q-076 takes a file the server already received as kept although the phone cannot read it", () => {
		const unreadable = file("a", { uploadState: UPLOAD_STATE.UNREADABLE })
		const onServer = { file_key: "a", sequence: 1, status: "received" as const }

		expect(shownFilesOf([unreadable], [onServer])).toMatchObject([{ fileKey: "a", condition: FILE_CONDITION.KEPT }])
	})

	it("CAP-015-S51 E111 shows a file still waiting on another device", () => {
		const elsewhere = { file_key: "a", sequence: 1, status: "announced" as const, pending_on_other_device: true }

		expect(shownFilesOf([], [elsewhere])).toMatchObject([{ fileKey: "a", condition: FILE_CONDITION.ON_OTHER_DEVICE }])
	})

	it("CAP-015-R35 CAP-018-R14 places the files only the server has by the order it leads", () => {
		const server = [
			{ file_key: "x", sequence: 1, status: "received" as const },
			{ file_key: "a", sequence: 2, status: "received" as const },
			{ file_key: "y", sequence: 3, status: "received" as const },
		]

		expect(shownFilesOf([received("a"), file("b")], server).map((shown) => shown.fileKey)).toEqual(["x", "a", "y", "b"])
	})

	it("CAP-015-R36 CAP-019-S12 shows the new photo in place of the rejected one it replaces", () => {
		const replacement = file("n", { replacesFileKey: "x" })
		const server = [
			{ file_key: "a", sequence: 1, status: "received" as const },
			{ file_key: "x", sequence: 2, status: "rejected" as const },
		]

		expect(shownFilesOf([received("a"), replacement], server)).toMatchObject([
			{ fileKey: "a", condition: FILE_CONDITION.KEPT },
			{ fileKey: "n", condition: FILE_CONDITION.KEPT },
		])
	})

	it("CAP-015-R36 CAP-015-R35 keeps a later file of another device after the photo that took a rejected one's place", () => {
		const server = [
			{ file_key: "a", sequence: 1, status: "received" as const },
			{ file_key: "x", sequence: 2, status: "rejected" as const },
			{ file_key: "c", sequence: 3, status: "received" as const },
			{ file_key: "d", sequence: 4, status: "received" as const },
		]
		const local = [received("a"), file("n", { replacesFileKey: "x" }), received("c")]

		expect(shownFilesOf(local, server).map((shown) => shown.fileKey)).toEqual(["a", "n", "c", "d"])
	})

	it("CAP-015-R36 CAP-019-S12 puts the new photo of a file only the server had in that file's place", () => {
		const server = [
			{ file_key: "a", sequence: 1, status: "received" as const },
			{ file_key: "x", sequence: 2, status: "rejected" as const },
			{ file_key: "c", sequence: 3, status: "received" as const },
		]
		const local = [received("a"), received("c"), file("n", { replacesFileKey: "x" })]

		expect(shownFilesOf(local, server).map((shown) => shown.fileKey)).toEqual(["a", "n", "c"])
	})
})

describe("removedElsewhereOf", () => {
	it("CAP-015-R18 CAP-021-R32 finds the received files the server no longer holds in the record", () => {
		const received = file("a", { uploadState: UPLOAD_STATE.RECEIVED })
		const gone = file("b", { uploadState: UPLOAD_STATE.RECEIVED })
		const waiting = file("c")

		expect(
			removedElsewhereOf([received, gone, waiting], [{ file_key: "a" }]).map((removed) => removed.fileKey),
		).toEqual(["b"])
	})
})

describe("rejectionOf", () => {
	it("CAP-019-R14 CAP-015-R36 E112 asks for a new photo in the same open record", () => {
		expect(rejectionOf(null)).toBe(REJECTION.OPEN_RECORD)
		expect(rejectionOf("record-rejected")).toBe(REJECTION.OPEN_RECORD)
		expect(rejectionOf("idempotency-conflict")).toBe(REJECTION.OPEN_RECORD)
	})

	it("CAP-019-S18 CAP-019-S19 E113 does not ask for a photo of a decided record", () => {
		expect(rejectionOf("acquisition-already-decided")).toBe(REJECTION.DECIDED)
	})

	it("CAP-019-R20 CAP-019-R27 E27 tells a record the server does not know", () => {
		expect(rejectionOf("resource-not-found")).toBe(REJECTION.UNKNOWN_RECORD)
		expect(rejectionOf("a-code-of-a-later-release")).toBe(REJECTION.UNKNOWN_RECORD)
	})
})

describe("uploadStepOf", () => {
	it("CAP-019-R24 sends a waiting file and nothing else", () => {
		expect(uploadStepOf(file("a"))).toBe(UPLOAD_STEP.SEND)
		expect(uploadStepOf(file("a", { uploadState: UPLOAD_STATE.UPLOADING }))).toBe(UPLOAD_STEP.NONE)
		expect(uploadStepOf(file("a", { uploadState: UPLOAD_STATE.REJECTED }))).toBe(UPLOAD_STEP.NONE)
	})

	it("CAP-015-S56 replaces a received file edited since", () => {
		const turned = file("a", { uploadState: UPLOAD_STATE.RECEIVED, receivedContentFileId: "a-original" })

		expect(uploadStepOf(turned)).toBe(UPLOAD_STEP.REPLACE)
		expect(uploadStepOf({ ...turned, editFailedContentFileId: "a-content" })).toBe(UPLOAD_STEP.NONE)
		expect(uploadStepOf({ ...turned, receivedContentFileId: "a-content" })).toBe(UPLOAD_STEP.NONE)
	})
})

describe("reconciliationsOf", () => {
	it("CAP-019-R24 takes over the receipt the server already has", () => {
		const local = [file("a", { uploadState: UPLOAD_STATE.UPLOADING, sentContentFileId: "a-sent" }), file("b")]

		expect(reconciliationsOf(local, [{ file_key: "a", status: "received" }])).toEqual([
			{ kind: "received", fileKey: "a", contentFileId: "a-sent" },
		])
	})

	it("CAP-015-R36 marks a file the server rejected", () => {
		expect(reconciliationsOf([file("a")], [{ file_key: "a", status: "rejected" }])).toEqual([
			{ kind: "rejected", fileKey: "a" },
		])
	})
})

describe("serverOrderOf", () => {
	it("CAP-015-R35 CAP-018-R11 takes over the order the server leads", () => {
		const local = [file("a"), file("b"), file("c"), file("d")]
		const server = [
			{ file_key: "a", sequence: 2 },
			{ file_key: "c", sequence: 1 },
			{ file_key: "b", sequence: 3 },
		]

		expect(serverOrderOf(local, server)).toEqual(["c", "a", "b", "d"])
	})

	it("CAP-015-R35 keeps the local order that already follows the server", () => {
		const local = [file("a"), file("b"), file("c")]

		expect(
			serverOrderOf(local, [
				{ file_key: "b", sequence: 7 },
				{ file_key: "a", sequence: 3 },
			]),
		).toBeUndefined()
	})
})

describe("recordFilesStateOf", () => {
	const received = (fileKey: string) =>
		file(fileKey, { uploadState: UPLOAD_STATE.RECEIVED, receivedContentFileId: `${fileKey}-content` })

	it("CAP-021-R25 closes when the server holds every confirmed file", () => {
		const server = [
			{ file_key: "a", sequence: 1, status: "received" as const },
			{ file_key: "b", sequence: 2, status: "received" as const },
		]

		expect(recordFilesStateOf(["a", "b"], [received("a"), received("b")], server)).toBe(RECORD_FILES.COMPLETE)
	})

	it("CAP-019-R24 CAP-021-R25 closes by the server while the receipt on the phone lags", () => {
		const server = [
			{ file_key: "a", sequence: 1, status: "received" as const },
			{ file_key: "b", sequence: 2, status: "received" as const },
		]
		const lagging = file("b", { uploadState: UPLOAD_STATE.UPLOADING })

		expect(recordFilesStateOf(["a", "b"], [received("a"), lagging], server)).toBe(RECORD_FILES.COMPLETE)
	})

	it("CAP-019-R29 waits for the files this phone still uploads", () => {
		const server = [
			{ file_key: "a", sequence: 1, status: "received" as const },
			{ file_key: "b", sequence: 2, status: "announced" as const, pending_on_other_device: false },
		]

		expect(recordFilesStateOf(["a", "b", "c"], [received("a"), file("b"), file("c")], server)).toBe(
			RECORD_FILES.UPLOADING,
		)
	})

	it("CAP-021-R32 CAP-015-S52 never closes another set of files than the operator confirmed", () => {
		const added = [
			{ file_key: "a", sequence: 1, status: "received" as const },
			{ file_key: "x", sequence: 4, status: "received" as const },
		]
		const removed = [{ file_key: "a", sequence: 1, status: "received" as const }]

		expect(recordFilesStateOf(["a"], [received("a")], added)).toBe(RECORD_FILES.CHANGED)
		expect(recordFilesStateOf(["a", "b"], [received("a"), received("b")], removed)).toBe(RECORD_FILES.CHANGED)
		expect(recordFilesStateOf(["a", "b"], [received("a")], removed)).toBe(RECORD_FILES.CHANGED)
	})

	it("CAP-019-S18 E113 does not close without a confirmed file the server already decided about", () => {
		const decided = file("b", { uploadState: UPLOAD_STATE.REJECTED, rejectionCode: "acquisition-already-decided" })

		expect(
			recordFilesStateOf(["a", "b"], [received("a"), decided], [{ file_key: "a", sequence: 1, status: "received" }]),
		).toBe(RECORD_FILES.CHANGED)
	})

	it("CAP-015-R36 E112 CAP-015-S51 E111 stops at a rejected file and at a file of another device", () => {
		const rejected = file("b", { uploadState: UPLOAD_STATE.REJECTED, rejectionCode: "record-rejected" })
		const elsewhere = [{ file_key: "a", sequence: 1, status: "announced" as const, pending_on_other_device: true }]

		expect(recordFilesStateOf(["a", "b"], [received("a"), rejected], [])).toBe(RECORD_FILES.REJECTED)
		expect(recordFilesStateOf(["a"], [file("a")], elsewhere)).toBe(RECORD_FILES.ON_OTHER_DEVICE)
	})

	it("CAP-009-S05 Q-076 stops at an unreadable file and at a file the phone lost", () => {
		const unreadable = file("b", { uploadState: UPLOAD_STATE.UNREADABLE })
		const lost = [
			{ file_key: "a", sequence: 1, status: "received" as const },
			{ file_key: "b", sequence: 2, status: "announced" as const, pending_on_other_device: false },
		]

		expect(recordFilesStateOf(["a", "b"], [received("a"), unreadable], [])).toBe(RECORD_FILES.UNREADABLE)
		expect(recordFilesStateOf(["a", "b"], [received("a")], lost)).toBe(RECORD_FILES.UNREADABLE)
	})

	it("CAP-015-R35 CAP-018-R14 closes with a file another device already uploaded", () => {
		const server = [
			{ file_key: "x", sequence: 1, status: "received" as const },
			{ file_key: "a", sequence: 2, status: "received" as const },
		]

		expect(recordFilesStateOf(["x", "a"], [received("a")], server)).toBe(RECORD_FILES.COMPLETE)
	})

	it("CAP-019-S12 waits for the new photo instead of stopping at the rejected one it replaces", () => {
		const server = [
			{ file_key: "a", sequence: 1, status: "received" as const },
			{ file_key: "x", sequence: 2, status: "rejected" as const },
		]

		expect(recordFilesStateOf(["a", "n"], [received("a"), file("n", { replacesFileKey: "x" })], server)).toBe(
			RECORD_FILES.UPLOADING,
		)
	})
})
