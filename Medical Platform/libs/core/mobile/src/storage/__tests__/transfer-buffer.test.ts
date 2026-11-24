import { describe, expect, it } from "vitest"
import type { SecuredPhoto } from "../../native"
import { openEncryptedDatabase } from "../encrypted-database"
import { EncryptedFileStore, type StoredFileRecords } from "../encrypted-file-store"
import { SerialSqlDatabase } from "../sql-database"
import { SqlStoredFileRecords } from "../sql-stored-file-records"
import {
	BufferedFileNotFoundError,
	FILE_EDIT,
	mergedEdit,
	needsReplacement,
	orderedKeys,
	SqlBufferedFileRecords,
	SqlSealedCopyRecords,
	TransferBuffer,
	UPLOAD_STATE,
} from "../transfer-buffer"
import { FakeCipher } from "./fake-cipher"
import { NodeSqlDatabase } from "./node-sql-database"

const FIXED_TIME = new Date("2026-10-08T09:00:00.000Z")
const DATABASE_KEY = "ab".repeat(32)
const ACQUISITION = "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10"
const OPERATOR = "5f3a9e1c-2b7d-4c55-8e0a-7d1b2c3e4f50"
const OTHER_OPERATOR = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a"

interface FreshBuffer {
	buffer: TransferBuffer
	cipher: FakeCipher
	stored: StoredFileRecords
	buffered: SqlBufferedFileRecords
	db: SerialSqlDatabase
}

async function freshBuffer(now: () => Date = () => FIXED_TIME): Promise<FreshBuffer> {
	const opened = await openEncryptedDatabase("queue", DATABASE_KEY, "/vault/queue", async () => new NodeSqlDatabase())
	const db = new SerialSqlDatabase(opened)
	const cipher = new FakeCipher()
	const stored = new SqlStoredFileRecords(db)
	const buffered = new SqlBufferedFileRecords(db)
	const files = new EncryptedFileStore("queue", cipher, stored, () => FIXED_TIME)
	const sealed = new SqlSealedCopyRecords(db)
	return { buffer: new TransferBuffer(files, buffered, sealed, now), cipher, stored, buffered, db }
}

function securedPhoto(cipher: FakeCipher, name: string, width: number, height: number): SecuredPhoto {
	return { image: cipher.sealedByModule(name), thumbnail: cipher.sealedByModule(`${name}-thumbnail`), width, height }
}

function securedPage(cipher: FakeCipher, name: string) {
	return {
		...securedPhoto(cipher, name, 2480, 3508),
		original: cipher.sealedByModule(`${name}-original`),
		corners: "[]",
	}
}

async function markUnreadable(buffer: TransferBuffer, fileKey: string): Promise<void> {
	const file = await buffer.find(fileKey)
	if (file === undefined) {
		throw new Error(`the buffer holds no file ${fileKey}`)
	}
	await buffer.markUnreadable(file)
}

function ownedBy(operatorUserId: string, fileKey: string) {
	return { fileKey, acquisitionId: ACQUISITION, operatorUserId }
}

function failOnInsert(records: StoredFileRecords, failingCall: number): void {
	const insert = records.insert.bind(records)
	let calls = 0
	records.insert = async (record) => {
		calls += 1
		if (calls === failingCall) {
			throw new Error("database closed")
		}
		await insert(record)
	}
}

describe("TransferBuffer", () => {
	it("CAP-015-S04 keeps the series of an operator in the order of capture", async () => {
		const { buffer, cipher } = await freshBuffer()

		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 3024, 4032))
		await buffer.addPhoto(ownedBy(OPERATOR, "b"), securedPhoto(cipher, "b", 3024, 4032))
		await buffer.addPhoto(ownedBy(OTHER_OPERATOR, "c"), securedPhoto(cipher, "c", 3024, 4032))

		const photos = await buffer.photos(ACQUISITION, OPERATOR)
		expect(photos.map((photo) => [photo.fileKey, photo.position])).toEqual([
			["a", 1],
			["b", 2],
		])
		const [first] = photos
		expect(first && new TextDecoder().decode(await buffer.thumbnail(first))).toBe("a-thumbnail")
	})

	it("CAP-015-S04 gives photos added at the same time distinct positions", async () => {
		const { buffer, cipher } = await freshBuffer()

		const added = await Promise.all(
			["a", "b", "c"].map((name) => buffer.addPhoto(ownedBy(OPERATOR, name), securedPhoto(cipher, name, 1, 1))),
		)

		expect(added.map((photo) => photo.position).sort()).toEqual([1, 2, 3])
		expect((await buffer.photos(ACQUISITION, OPERATOR)).map((photo) => photo.position)).toEqual([1, 2, 3])
	})

	it("CAP-015-R34 puts the edited photo in place of the original and keeps no copy of it", async () => {
		const { buffer, cipher, stored } = await freshBuffer()
		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 3024, 4032))

		const replaced = await buffer.replacePhoto("a", securedPhoto(cipher, "a-turned", 4032, 3024), FILE_EDIT.ROTATION)

		expect(replaced).toMatchObject({ position: 1, width: 4032, height: 3024 })
		expect(cipher.files.has("/vault/queue/a")).toBe(false)
		expect(cipher.files.has("/vault/queue/a-thumbnail")).toBe(false)
		expect(await stored.find("/vault/queue/a")).toBeUndefined()
		expect((await buffer.content(replaced)).path).toBe("/vault/queue/a-turned")
	})

	it("CAP-009-R18 destroys the key records and ciphertexts of a removed photo", async () => {
		const { buffer, cipher, stored } = await freshBuffer()
		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 3024, 4032))

		await buffer.remove("a")

		expect(await buffer.photos(ACQUISITION, OPERATOR)).toEqual([])
		expect(cipher.files.size).toBe(0)
		expect(await stored.find("/vault/queue/a-thumbnail")).toBeUndefined()
		await expect(buffer.remove("a")).rejects.toBeInstanceOf(BufferedFileNotFoundError)
	})

	it("discards the thumbnail when the photo cannot be adopted", async () => {
		const { buffer, cipher, stored } = await freshBuffer()
		failOnInsert(stored, 1)

		await expect(buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))).rejects.toThrow(
			"database closed",
		)

		expect(cipher.files.size).toBe(0)
		expect(await buffer.photos(ACQUISITION, OPERATOR)).toEqual([])
	})

	it("destroys the adopted photo when the thumbnail cannot be adopted", async () => {
		const { buffer, cipher, stored } = await freshBuffer()
		failOnInsert(stored, 2)

		await expect(buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))).rejects.toThrow(
			"database closed",
		)

		expect(cipher.files.size).toBe(0)
		expect(await stored.find("/vault/queue/a")).toBeUndefined()
	})

	it("destroys both adopted files when the photo cannot be buffered", async () => {
		const { buffer, cipher, stored, buffered } = await freshBuffer()
		buffered.insertAtNextPosition = async () => {
			throw new Error("database closed")
		}

		await expect(buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))).rejects.toThrow(
			"database closed",
		)

		expect(cipher.files.size).toBe(0)
		expect(await stored.find("/vault/queue/a")).toBeUndefined()
		expect(await stored.find("/vault/queue/a-thumbnail")).toBeUndefined()
	})

	it("CAP-015-R34 keeps the original when the edited photo cannot take its place", async () => {
		const { buffer, cipher, stored, buffered } = await freshBuffer()
		const original = await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 3024, 4032))
		buffered.replaceContent = async () => {
			throw new Error("database closed")
		}

		await expect(
			buffer.replacePhoto("a", securedPhoto(cipher, "a-turned", 4032, 3024), FILE_EDIT.ROTATION),
		).rejects.toThrow("database closed")

		expect(await buffer.photos(ACQUISITION, OPERATOR)).toEqual([original])
		expect([...cipher.files.keys()].sort()).toEqual(["/vault/queue/a", "/vault/queue/a-thumbnail"])
		expect(await stored.find("/vault/queue/a-turned")).toBeUndefined()
	})

	it("discards the edited photo of a photo that is no longer buffered", async () => {
		const { buffer, cipher } = await freshBuffer()

		await expect(
			buffer.replacePhoto("gone", securedPhoto(cipher, "gone-turned", 1, 1), FILE_EDIT.CROP),
		).rejects.toBeInstanceOf(BufferedFileNotFoundError)

		expect(cipher.files.size).toBe(0)
	})
})

describe("TransferBuffer pages", () => {
	it("CAP-018-R11 keeps the original of a page for a later crop and destroys it with the page", async () => {
		const { buffer, cipher } = await freshBuffer()

		const page = await buffer.addPage(ownedBy(OPERATOR, "p"), securedPage(cipher, "p"))

		expect(page).toMatchObject({ kind: "document_page", position: 1, corners: "[]" })
		expect((await buffer.original(page))?.path).toBe("/vault/queue/p-original")
		await buffer.remove("p")
		expect(cipher.files.size).toBe(0)
	})

	it("CAP-018-R11 keeps the original when the page is cropped again", async () => {
		const { buffer, cipher } = await freshBuffer()
		await buffer.addPage(ownedBy(OPERATOR, "p"), securedPage(cipher, "p"))

		const cropped = await buffer.replacePage("p", securedPhoto(cipher, "p-cropped", 2000, 3000), "[1]", FILE_EDIT.CROP)

		expect(cropped).toMatchObject({ corners: "[1]", contentEdit: "crop", width: 2000 })
		expect((await buffer.original(cropped))?.path).toBe("/vault/queue/p-original")
		expect(cipher.files.has("/vault/queue/p")).toBe(false)
	})

	it("CAP-018-S10 moves the pages into the order the user chose", async () => {
		const { buffer, cipher } = await freshBuffer()
		for (const name of ["a", "b", "c"]) {
			await buffer.addPage(ownedBy(OPERATOR, name), securedPage(cipher, name))
		}

		await buffer.reorder(ACQUISITION, ["c", "a"])

		const pages = await buffer.photos(ACQUISITION, OPERATOR)
		expect(pages.map((page) => [page.fileKey, page.position])).toEqual([
			["c", 1],
			["a", 2],
			["b", 3],
		])
	})

	it("CAP-018-S10 CAP-019-R24 keeps uploads and edits that run while the pages are being moved", async () => {
		const { buffer, cipher } = await freshBuffer()
		for (const name of ["a", "b", "c"]) {
			await buffer.addPage(ownedBy(OPERATOR, name), securedPage(cipher, name))
		}

		await Promise.all([
			buffer.reorder(ACQUISITION, ["c", "a"]),
			buffer.markReceived("b", "/vault/queue/b"),
			buffer.replacePage("a", securedPhoto(cipher, "a-cropped", 1, 1), "[1]", FILE_EDIT.CROP),
			buffer.reorder(ACQUISITION, ["b"]),
		])

		const pages = await buffer.photos(ACQUISITION, OPERATOR)
		expect(pages.map((page) => page.fileKey)).toEqual(["b", "c", "a"])
		expect(pages.find((page) => page.fileKey === "b")?.uploadState).toBe(UPLOAD_STATE.RECEIVED)
		const cropped = pages.find((page) => page.fileKey === "a")
		expect(cropped?.contentFileId).toBe("/vault/queue/a-cropped")
		expect(cropped && new TextDecoder().decode(await buffer.thumbnail(cropped))).toBe("a-cropped-thumbnail")
	})
})

const HOUR_MS = 3_600_000

function clockFrom(start: Date) {
	let current = start
	return {
		now: () => current,
		advance: (milliseconds: number) => {
			current = new Date(current.getTime() + milliseconds)
		},
	}
}

function keysOf(files: readonly { fileKey: string }[]): string[] {
	return files.map((file) => file.fileKey)
}

describe("TransferBuffer local copies CAP-026-R08", () => {
	it("CAP-026-S12 offers only the copies the server received before the cutoff, each by its own receipt", async () => {
		const clock = clockFrom(FIXED_TIME)
		const { buffer, cipher } = await freshBuffer(clock.now)
		const first = await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		const second = await buffer.addPhoto(ownedBy(OPERATOR, "b"), securedPhoto(cipher, "b", 1, 1))
		await buffer.addPhoto(ownedBy(OPERATOR, "c"), securedPhoto(cipher, "c", 1, 1))

		await buffer.markReceived("a", first.contentFileId)
		clock.advance(HOUR_MS)
		await buffer.markReceived("b", second.contentFileId)

		expect(keysOf(await buffer.expiredCopies(FIXED_TIME))).toEqual(["a"])
		expect(keysOf(await buffer.expiredCopies(clock.now()))).toEqual(["a", "b"])
	})

	it("CAP-019-R03 never offers a copy the server has not received", async () => {
		const { buffer, cipher } = await freshBuffer()
		const photo = await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))

		await buffer.markUploading(photo)

		expect(await buffer.expiredCopies(new Date(FIXED_TIME.getTime() + HOUR_MS))).toEqual([])
	})

	it("keeps the moment of the first receipt when the server confirms the same content again", async () => {
		const clock = clockFrom(FIXED_TIME)
		const { buffer, cipher } = await freshBuffer(clock.now)
		const photo = await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await buffer.markReceived("a", photo.contentFileId)

		clock.advance(HOUR_MS)
		await buffer.markReceived("a", photo.contentFileId)

		expect(keysOf(await buffer.expiredCopies(FIXED_TIME))).toEqual(["a"])
	})

	it("CAP-015-R34 keeps a copy with an edit to send and starts its period at the receipt of the edit", async () => {
		const clock = clockFrom(FIXED_TIME)
		const { buffer, cipher } = await freshBuffer(clock.now)
		const photo = await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await buffer.markReceived("a", photo.contentFileId)
		const turned = await buffer.replacePhoto("a", securedPhoto(cipher, "a-turned", 1, 1), FILE_EDIT.ROTATION)

		expect(await buffer.expiredCopies(FIXED_TIME)).toEqual([])

		clock.advance(HOUR_MS)
		await buffer.markReceived("a", turned.contentFileId)

		expect(await buffer.expiredCopies(FIXED_TIME)).toEqual([])
		expect(keysOf(await buffer.expiredCopies(clock.now()))).toEqual(["a"])
	})
})

describe("TransferBuffer uploads", () => {
	it("CAP-019-R24 waits until the server confirms the file it was sent", async () => {
		const { buffer, cipher } = await freshBuffer()
		const photo = await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		expect(photo.uploadState).toBe(UPLOAD_STATE.WAITING)

		await buffer.markUploading(photo)
		await buffer.markReceived("a", photo.contentFileId)

		const received = await buffer.find("a")
		expect(received).toMatchObject({ uploadState: "received", receivedContentFileId: photo.contentFileId })
		expect(received && needsReplacement(received)).toBe(false)
	})

	it("CAP-015-S56 replaces on the server a photo turned while it was on its way", async () => {
		const { buffer, cipher } = await freshBuffer()
		const photo = await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await buffer.markUploading(photo)

		await buffer.replacePhoto("a", securedPhoto(cipher, "a-turned", 1, 1), FILE_EDIT.ROTATION)
		await buffer.markReceived("a", photo.contentFileId)

		const received = await buffer.find("a")
		expect(received && needsReplacement(received)).toBe(true)
		expect(received?.contentEdit).toBe("rotation")
	})

	it("CAP-015-R34 E115 keeps a received file received when the server refused its edit", async () => {
		const { buffer, cipher } = await freshBuffer()
		const photo = await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await buffer.markReceived("a", photo.contentFileId)
		const turned = await buffer.replacePhoto("a", securedPhoto(cipher, "a-turned", 1, 1), FILE_EDIT.ROTATION)

		await buffer.markEditFailed(turned, "acquisition-version-conflict")

		const refused = await buffer.find("a")
		expect(refused).toMatchObject({ uploadState: "received", rejectionCode: "acquisition-version-conflict" })
		expect(refused && needsReplacement(refused)).toBe(false)
		expect(refused?.editFailedContentFileId).toBe(refused?.contentFileId)
	})

	it("CAP-015-R34 sends a new edit of a file whose earlier edit the server refused", async () => {
		const { buffer, cipher } = await freshBuffer()
		const photo = await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await buffer.markReceived("a", photo.contentFileId)
		await buffer.markEditFailed(
			await buffer.replacePhoto("a", securedPhoto(cipher, "a-turned", 1, 1), FILE_EDIT.ROTATION),
			null,
		)

		const cropped = await buffer.replacePhoto("a", securedPhoto(cipher, "a-cropped", 1, 1), FILE_EDIT.CROP)

		expect(needsReplacement(cropped)).toBe(true)
		expect(cropped.contentEdit).toBe("rotation_and_crop")
		await buffer.markReceived("a", cropped.contentFileId)
		expect(await buffer.find("a")).toMatchObject({ contentEdit: null, editFailedContentFileId: null })
	})

	it("CAP-021-R34 does not make up an edit the buffer does not know", async () => {
		const { buffer, cipher, db } = await freshBuffer()
		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))

		await db.runAsync("UPDATE buffered_file SET content_edit = ? WHERE file_key = ?", ["mirror", "a"])

		expect((await buffer.find("a"))?.contentEdit).toBeNull()
	})

	it("CAP-015-R36 keeps a permanently rejected file with its code", async () => {
		const { buffer, cipher } = await freshBuffer()
		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))

		await buffer.markRejected("a", "record-rejected")

		expect(await buffer.find("a")).toMatchObject({ uploadState: "rejected", rejectionCode: "record-rejected" })
	})

	it("CAP-009-R13 discards the sealed copies of a file once its upload ended", async () => {
		const { buffer, cipher } = await freshBuffer()
		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await buffer.keepSealedCopy("a", cipher.sealedByModule("a-sealed"))

		await buffer.discardSealedCopies("a")

		expect(cipher.files.has("/vault/queue/a-sealed")).toBe(false)
	})

	it("CAP-019-R04 lists the files of every operator on the device for the queue", async () => {
		const { buffer, cipher } = await freshBuffer()
		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await buffer.addPhoto(ownedBy(OTHER_OPERATOR, "b"), securedPhoto(cipher, "b", 1, 1))

		expect((await buffer.queued()).map((file) => file.fileKey)).toEqual(["a", "b"])
	})
})

describe("TransferBuffer failed files", () => {
	it("CAP-009-S05 Q-076 marks a file it cannot read and stops it from waiting", async () => {
		const { buffer, cipher } = await freshBuffer()
		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await buffer.addPhoto(ownedBy(OPERATOR, "b"), securedPhoto(cipher, "b", 1, 1))
		await buffer.markReceived("b", "/vault/queue/b")

		await markUnreadable(buffer, "a")
		await markUnreadable(buffer, "b")

		expect(await buffer.find("a")).toMatchObject({ uploadState: UPLOAD_STATE.UNREADABLE })
		expect(await buffer.find("b")).toMatchObject({ uploadState: UPLOAD_STATE.RECEIVED })
	})

	it("CAP-015-R34 Q-076 does not mark a file whose content an edit replaced after it failed", async () => {
		const { buffer, cipher } = await freshBuffer()
		const failed = await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await buffer.replacePhoto("a", securedPhoto(cipher, "a-turned", 1, 1), FILE_EDIT.ROTATION)

		await buffer.markUnreadable(failed)

		expect(await buffer.find("a")).toMatchObject({ uploadState: UPLOAD_STATE.WAITING })
	})

	it("CAP-019-S12 CAP-009-S05 Q-076 takes a failed file out of the record and keeps it on the device", async () => {
		const { buffer, cipher } = await freshBuffer()
		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await buffer.addPhoto(ownedBy(OPERATOR, "b"), securedPhoto(cipher, "b", 1, 1))
		await buffer.markRejected("a", "record-rejected")
		await markUnreadable(buffer, "b")
		const kept = cipher.files.size

		await buffer.removeFromRecord("a")
		await buffer.removeFromRecord("b")

		expect(await buffer.photos(ACQUISITION, OPERATOR)).toEqual([])
		expect((await buffer.queued()).map((file) => [file.fileKey, file.uploadState])).toEqual([
			["a", UPLOAD_STATE.REJECTED],
			["b", UPLOAD_STATE.UNREADABLE],
		])
		expect(cipher.files.size).toBe(kept)
	})

	it("CAP-015-R36 Q-076 lists the failed files of an operator that are still in their records", async () => {
		const { buffer, cipher } = await freshBuffer()
		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await buffer.addPhoto(ownedBy(OPERATOR, "b"), securedPhoto(cipher, "b", 1, 1))
		await buffer.addPhoto(ownedBy(OPERATOR, "c"), securedPhoto(cipher, "c", 1, 1))
		await buffer.addPhoto(ownedBy(OTHER_OPERATOR, "d"), securedPhoto(cipher, "d", 1, 1))
		await buffer.markRejected("a", "record-rejected")
		await markUnreadable(buffer, "b")
		await markUnreadable(buffer, "c")
		await markUnreadable(buffer, "d")
		await buffer.removeFromRecord("c")

		expect((await buffer.failedInRecords(OPERATOR)).map((file) => file.fileKey)).toEqual(["a", "b"])
	})

	it("CAP-015-R18 CAP-009-R18 destroys a file that has not failed when it leaves the record", async () => {
		const { buffer, cipher } = await freshBuffer()
		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))

		await buffer.removeFromRecord("a")

		expect(await buffer.queued()).toEqual([])
		expect(cipher.files.size).toBe(0)
	})

	it("CAP-015-R36 CAP-019-S12 puts the new photo in place of the rejected one and keeps the rejected one aside", async () => {
		const { buffer, cipher } = await freshBuffer()
		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await buffer.addPhoto(ownedBy(OPERATOR, "b"), securedPhoto(cipher, "b", 1, 1))
		await buffer.markRejected("a", "record-rejected")

		const added = await buffer.addPhoto(ownedBy(OPERATOR, "n"), securedPhoto(cipher, "n", 1, 1), "a")

		expect(added).toMatchObject({ fileKey: "n", position: 1, replacesFileKey: "a" })
		expect((await buffer.photos(ACQUISITION, OPERATOR)).map((file) => [file.fileKey, file.position])).toEqual([
			["n", 1],
			["b", 2],
		])
		expect(await buffer.find("a")).toMatchObject({ uploadState: UPLOAD_STATE.REJECTED, position: 3 })
	})

	it("CAP-015-R36 puts the new photo in place of a rejected last photo", async () => {
		const { buffer, cipher } = await freshBuffer()
		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await buffer.addPhoto(ownedBy(OPERATOR, "b"), securedPhoto(cipher, "b", 1, 1))
		await buffer.markRejected("b", "record-rejected")

		await buffer.addPhoto(ownedBy(OPERATOR, "n"), securedPhoto(cipher, "n", 1, 1), "b")

		expect((await buffer.photos(ACQUISITION, OPERATOR)).map((file) => [file.fileKey, file.position])).toEqual([
			["a", 1],
			["n", 2],
		])
	})

	it("CAP-015-R36 does not replace a rejected file of another record", async () => {
		const { buffer, cipher } = await freshBuffer()
		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await buffer.markRejected("a", "record-rejected")

		const added = await buffer.addPhoto(
			{ ...ownedBy(OPERATOR, "n"), acquisitionId: "other-series" },
			securedPhoto(cipher, "n", 1, 1),
			"a",
		)

		expect(added).toMatchObject({ fileKey: "n", position: 1, replacesFileKey: null })
		expect(await buffer.find("a")).toMatchObject({ uploadState: UPLOAD_STATE.REJECTED, position: 1 })
	})

	it("CAP-019-S12 does not replace a rejected file already taken out of the record", async () => {
		const { buffer, cipher } = await freshBuffer()
		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await buffer.markRejected("a", "record-rejected")
		await buffer.removeFromRecord("a")

		const added = await buffer.addPhoto(ownedBy(OPERATOR, "n"), securedPhoto(cipher, "n", 1, 1), "a")

		expect(added).toMatchObject({ fileKey: "n", replacesFileKey: null })
		expect((await buffer.photos(ACQUISITION, OPERATOR)).map((file) => file.fileKey)).toEqual(["n"])
	})

	it("CAP-015-R36 replaces a rejected file the phone does not hold only on the server", async () => {
		const { buffer, cipher } = await freshBuffer()

		const added = await buffer.addPage(ownedBy(OPERATOR, "n"), securedPage(cipher, "n"), "lost")

		expect(added).toMatchObject({ fileKey: "n", position: 1, replacesFileKey: "lost" })
	})

	it("CAP-015-R36 does not replace a file the server has not rejected", async () => {
		const { buffer, cipher } = await freshBuffer()
		await buffer.addPhoto(ownedBy(OPERATOR, "a"), securedPhoto(cipher, "a", 1, 1))
		await markUnreadable(buffer, "a")

		const added = await buffer.addPhoto(ownedBy(OPERATOR, "n"), securedPhoto(cipher, "n", 1, 1), "a")

		expect(added).toMatchObject({ fileKey: "n", position: 2, replacesFileKey: null })
		expect((await buffer.photos(ACQUISITION, OPERATOR)).map((file) => file.fileKey)).toEqual(["a", "n"])
	})
})

describe("mergedEdit", () => {
	it("CAP-015-R34 merges a rotation and a crop of the same file", () => {
		expect(mergedEdit(null, FILE_EDIT.ROTATION)).toBe("rotation")
		expect(mergedEdit(FILE_EDIT.ROTATION, FILE_EDIT.ROTATION)).toBe("rotation")
		expect(mergedEdit(FILE_EDIT.ROTATION, FILE_EDIT.CROP)).toBe("rotation_and_crop")
		expect(mergedEdit(FILE_EDIT.ROTATION_AND_CROP, FILE_EDIT.CROP)).toBe("rotation_and_crop")
	})
})

describe("orderedKeys", () => {
	it("CAP-018-R11 puts files the order does not name after the named ones", () => {
		expect(orderedKeys(["a", "b", "c", "d"], ["c", "x", "a"])).toEqual(["c", "a", "b", "d"])
	})
})
