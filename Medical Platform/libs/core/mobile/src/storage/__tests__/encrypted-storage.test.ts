import { describe, expect, it, vi } from "vitest"
import { CodedError } from "../../__tests__/coded-error"
import type { CryptoAndKeys, KeyDomain } from "../../native"
import { openEncryptedStorage } from "../encrypted-storage"
import { FakeCipher } from "./fake-cipher"
import { NodeSqlDatabase } from "./node-sql-database"

vi.mock("expo-sqlite", () => ({ openDatabaseAsync: vi.fn() }))

const LOST_AT = new Date("2026-10-19T08:00:00.000Z")
const DATABASE_KEY = "ab".repeat(32)
const NURSE = "5f3a9e1c-2b7d-4c55-8e0a-7d1b2c3e4f50"

interface FakeKeys {
	module: CryptoAndKeys
	setAside: KeyDomain[]
}

function keysFailing(code: string): FakeKeys {
	const setAside: KeyDomain[] = []
	const cipher = new FakeCipher()
	const fake = {
		encryptFile: cipher.encryptFile.bind(cipher),
		encryptBytes: cipher.encryptBytes.bind(cipher),
		decryptFile: cipher.decryptFile.bind(cipher),
		removeFile: cipher.removeFile.bind(cipher),
		storageDirectory: async (domain: KeyDomain) => `/vault/${domain}`,
		databaseKey: async () => {
			if (setAside.length === 0) {
				throw new CodedError(code)
			}
			return DATABASE_KEY
		},
		setStorageAside: async (domain: KeyDomain) => {
			setAside.push(domain)
		},
	}
	return { module: fake as unknown as CryptoAndKeys, setAside }
}

const openNodeDatabase = async () => new NodeSqlDatabase()

class LossRefusingDatabase extends NodeSqlDatabase {
	isClosed = false

	override async runAsync(source: string, params: Parameters<NodeSqlDatabase["runAsync"]>[1]): Promise<unknown> {
		if (source.includes("INTO storage_loss ")) {
			throw new Error("disk full")
		}
		return await super.runAsync(source, params)
	}

	override async closeAsync(): Promise<void> {
		this.isClosed = true
		await super.closeAsync()
	}
}

describe("openEncryptedStorage", () => {
	it("CAP-009-S05 ADR-038 Q-076 sets aside a storage its key no longer opens and starts a new one", async () => {
		const keys = keysFailing("key-invalidated")

		const storage = await openEncryptedStorage("queue", keys.module, openNodeDatabase, () => LOST_AT)

		expect(keys.setAside).toEqual(["queue"])
		expect(await storage.buffer.queued()).toEqual([])
		expect(await storage.losses.unacknowledgedFor(NURSE)).toBe(LOST_AT.toISOString())
	})

	it("CAP-009-S05 sets nothing aside when the device is only locked", async () => {
		const keys = keysFailing("device-locked")

		await expect(openEncryptedStorage("queue", keys.module, openNodeDatabase)).rejects.toMatchObject({
			code: "device-locked",
		})
		expect(keys.setAside).toEqual([])
	})

	it("CAP-009-S05 Q-076 closes the new storage when it cannot note the loss", async () => {
		const keys = keysFailing("key-invalidated")
		const database = new LossRefusingDatabase()

		await expect(
			openEncryptedStorage(
				"queue",
				keys.module,
				async () => database,
				() => LOST_AT,
			),
		).rejects.toThrow("disk full")
		expect(database.isClosed).toBe(true)
	})

	it("CAP-009-S05 opens no new storage when the old one cannot be set aside", async () => {
		const keys = keysFailing("key-invalidated")
		keys.module.setStorageAside = async () => {
			throw new CodedError("key-storage-unavailable")
		}

		await expect(openEncryptedStorage("queue", keys.module, openNodeDatabase)).rejects.toMatchObject({
			code: "key-storage-unavailable",
		})
	})

	it("CAP-009-S05 Q-076 tells every user about the lost storage once", async () => {
		const keys = keysFailing("key-invalidated")
		const storage = await openEncryptedStorage("queue", keys.module, openNodeDatabase, () => LOST_AT)

		await storage.losses.acknowledge(LOST_AT.toISOString(), NURSE)

		expect(await storage.losses.unacknowledgedFor(NURSE)).toBeUndefined()
		expect(await storage.losses.unacknowledgedFor("9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a")).toBe(LOST_AT.toISOString())
	})
})
