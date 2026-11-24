import { describe, expect, it } from "vitest"
import type { KeyDomain } from "../../native"
import {
	EncryptedFileStore,
	type StoredFile,
	StoredFileNotFoundError,
	type StoredFileRecords,
} from "../encrypted-file-store"
import { FakeCipher } from "./fake-cipher"

class MemoryRecords implements StoredFileRecords {
	readonly rows = new Map<string, StoredFile>()

	async insert(record: StoredFile): Promise<void> {
		this.rows.set(record.id, record)
	}

	async find(id: string): Promise<StoredFile | undefined> {
		return this.rows.get(id)
	}

	async remove(id: string): Promise<void> {
		this.rows.delete(id)
	}
}

const FIXED_TIME = new Date("2026-09-21T10:00:00.000Z")

function storeWith(domain: KeyDomain, cipher: FakeCipher, records: MemoryRecords): EncryptedFileStore {
	return new EncryptedFileStore(domain, cipher, records, () => FIXED_TIME)
}

describe("EncryptedFileStore", () => {
	it("stores bytes under a wrapped key and reads them back", async () => {
		const cipher = new FakeCipher()
		const records = new MemoryRecords()
		const store = storeWith("queue", cipher, records)
		const data = new Uint8Array([1, 2, 3])

		const stored = await store.storeBytes("file-1", data)

		expect(stored).toEqual({
			id: "file-1",
			path: "/vault/queue/1",
			wrappedKey: "wrapped-1",
			createdAt: FIXED_TIME.toISOString(),
		})
		expect(records.rows.get("file-1")).toEqual(stored)
		expect(await store.read("file-1")).toEqual(data)
	})

	it("stores a file from its source path and lets the module discard the source", async () => {
		const cipher = new FakeCipher()
		const store = storeWith("queue", cipher, new MemoryRecords())

		await store.storeFile("file-2", "/tmp/capture.jpg")

		expect(cipher.removedSources).toEqual(["/tmp/capture.jpg"])
	})

	it("CAP-009-S04 rejects reading under a closed viewing key", async () => {
		const cipher = new FakeCipher()
		const store = storeWith("viewing", cipher, new MemoryRecords())
		await store.storeBytes("history-1", new Uint8Array([9]))
		cipher.viewingOpen = false

		await expect(store.read("history-1")).rejects.toMatchObject({ code: "viewing-key-locked" })
	})

	it("CAP-009-S08 keeps no record when the device has no space left", async () => {
		const cipher = new FakeCipher()
		const records = new MemoryRecords()
		const store = storeWith("queue", cipher, records)
		cipher.spaceLeft = false

		await expect(store.storeBytes("file-3", new Uint8Array([1]))).rejects.toMatchObject({ code: "storage-full" })
		expect(records.rows.size).toBe(0)
	})

	it("CAP-009-S12 destroys the wrapped key record before removing the ciphertext", async () => {
		const cipher = new FakeCipher()
		const records = new MemoryRecords()
		const store = storeWith("queue", cipher, records)
		const stored = await store.storeBytes("file-4", new Uint8Array([4]))

		await store.destroy("file-4")

		expect(records.rows.has("file-4")).toBe(false)
		expect(cipher.files.has(stored.path)).toBe(false)
		await expect(store.read("file-4")).rejects.toBeInstanceOf(StoredFileNotFoundError)
	})

	it("removes the ciphertext when the record cannot be written", async () => {
		const cipher = new FakeCipher()
		const records = new MemoryRecords()
		records.insert = async () => {
			throw new Error("database closed")
		}
		const store = storeWith("queue", cipher, records)

		await expect(store.storeBytes("file-5", new Uint8Array([5]))).rejects.toThrow("database closed")
		expect(cipher.files.size).toBe(0)
	})
})
