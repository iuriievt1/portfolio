import type { BufferedFile, SecuredPage } from "@ansora/core-mobile"
import { afterEach, describe, expect, it, vi } from "vitest"
import { captureSessionOf, forgetCaptureSessions, showCapturedPhotos, startShot } from "../capture-session"
import { type KeptShot, keepCapturedPhoto, keepScannedPage, whenShotsKept } from "../photo-buffer"

const buffer = vi.hoisted(() => ({
	addPage: async ({ fileKey }: { fileKey: string }, _page: unknown, replacedKey: string | null) =>
		({ fileKey, corners: null, replacesFileKey: replacedKey }) as unknown as BufferedFile,
	addPhoto: async ({ fileKey }: { fileKey: string }, _photo: unknown, replacedKey: string | null) =>
		({ fileKey, replacesFileKey: replacedKey }) as unknown as BufferedFile,
}))
const cancelledClosures = vi.hoisted(() => [] as string[])

vi.mock("@ansora/core-mobile", () => ({ camera: () => ({ securePhoto: async () => ({}) }), FILE_EDIT: {} }))
vi.mock("../../upload/transfer-store", () => ({ transferBuffer: async () => buffer }))
vi.mock("../../upload/upload-queue", () => ({ pumpUploads: () => undefined }))
vi.mock("../../upload/closure-queue", () => ({
	cancelQueuedClosure: async (acquisitionId: string) => {
		cancelledClosures.push(acquisitionId)
	},
}))

const OWNER = { acquisitionId: "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10", operatorUserId: "operator" }
const SCANNED = {} as SecuredPage
const NOTHING = () => undefined

function shotOf(fileKey: string, replacedKey: string | null = null): KeptShot {
	return { owner: OWNER, fileKey, replacedKey }
}

function deferred<T>() {
	let resolve: (value: T) => void = NOTHING
	let reject: (reason: unknown) => void = NOTHING
	const promise = new Promise<T>((settle, fail) => {
		resolve = settle
		reject = fail
	})
	return { promise, resolve, reject }
}

afterEach(() => {
	forgetCaptureSessions()
	cancelledClosures.length = 0
})

describe("pages kept in the background", () => {
	it("CAP-018-R11 keeps the pages in the order they were shot", async () => {
		const first = deferred<SecuredPage>()
		startShot(OWNER.acquisitionId, "first")
		startShot(OWNER.acquisitionId, "second")

		void keepScannedPage(shotOf("first"), () => first.promise, NOTHING, NOTHING)
		void keepScannedPage(shotOf("second"), async () => SCANNED, NOTHING, NOTHING)
		first.resolve(SCANNED)
		await whenShotsKept()

		expect(captureSessionOf(OWNER.acquisitionId).photos.map((page) => page.fileKey)).toEqual(["first", "second"])
		expect(captureSessionOf(OWNER.acquisitionId).shots).toEqual([])
	})

	it("CAP-015-R21 E17 reports a lost page before the series counts as kept", async () => {
		const problem = Object.assign(new Error("no room"), { code: "storage-full" })
		const lost = vi.fn()

		void keepScannedPage(shotOf("first"), async () => Promise.reject(problem), NOTHING, lost)
		await whenShotsKept()

		expect(lost).toHaveBeenCalledWith(problem)
	})

	it("CAP-018-R11 keeps the next page after one was lost", async () => {
		void keepScannedPage(shotOf("first"), async () => Promise.reject(new Error("lost")), NOTHING, NOTHING)
		void keepScannedPage(shotOf("second"), async () => SCANNED, NOTHING, NOTHING)
		await whenShotsKept()

		expect(captureSessionOf(OWNER.acquisitionId).photos.map((page) => page.fileKey)).toEqual(["second"])
	})

	it("CAP-018-R10 E21 asks about the edges before the series counts as kept", async () => {
		const kept = vi.fn()

		void keepScannedPage(shotOf("first"), async () => SCANNED, kept, NOTHING)
		await whenShotsKept()

		expect(kept).toHaveBeenCalledWith(expect.objectContaining({ fileKey: "first", corners: null }))
	})

	it("CAP-019-R29 a page added after the summary was confirmed voids the closure waiting in the queue", async () => {
		void keepScannedPage(shotOf("first"), async () => SCANNED, NOTHING, NOTHING)
		await whenShotsKept()

		expect(cancelledClosures).toEqual([OWNER.acquisitionId])
	})

	it("CAP-015-R36 CAP-019-S12 puts the new page in place of the rejected one in the series", async () => {
		const pageOf = (fileKey: string) => ({ fileKey, replacesFileKey: null }) as unknown as BufferedFile
		showCapturedPhotos(OWNER.acquisitionId, [pageOf("a"), pageOf("x"), pageOf("b")])

		void keepScannedPage(shotOf("n", "x"), async () => SCANNED, NOTHING, NOTHING)
		await whenShotsKept()

		expect(captureSessionOf(OWNER.acquisitionId).photos.map((page) => page.fileKey)).toEqual(["a", "n", "b"])
	})

	it("CAP-015-R36 CAP-019-S12 puts the new photo in place of the rejected one in the series", async () => {
		const photoOf = (fileKey: string) => ({ fileKey, replacesFileKey: null }) as unknown as BufferedFile
		showCapturedPhotos(OWNER.acquisitionId, [photoOf("a"), photoOf("x"), photoOf("b")])

		void keepCapturedPhoto(shotOf("n", "x"), new Uint8Array(), NOTHING)
		await whenShotsKept()

		expect(captureSessionOf(OWNER.acquisitionId).photos.map((photo) => photo.fileKey)).toEqual(["a", "n", "b"])
	})

	it("CAP-019-R29 a lost page leaves the closure waiting in the queue", async () => {
		void keepScannedPage(shotOf("first"), async () => Promise.reject(new Error("lost")), NOTHING, NOTHING)
		await whenShotsKept()

		expect(cancelledClosures).toEqual([])
	})
})
