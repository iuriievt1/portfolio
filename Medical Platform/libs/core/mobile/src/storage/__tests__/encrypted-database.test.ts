import { describe, expect, it } from "vitest"
import { DatabaseKeyInvalidError, databaseFileName, openEncryptedDatabase } from "../encrypted-database"
import { SqlStoredFileRecords } from "../sql-stored-file-records"
import { applyStorageSchema, STORAGE_SCHEMA_VERSION } from "../storage-schema"
import { NodeSqlDatabase } from "./node-sql-database"

const VALID_KEY = "ab".repeat(32)

describe("openEncryptedDatabase", () => {
	it("CAP-009-S12 keys the database first and turns secure_delete and foreign keys on before any schema", async () => {
		let opened: NodeSqlDatabase | undefined
		const db = await openEncryptedDatabase("queue", VALID_KEY, "/vault/queue", async (fileName, directory) => {
			expect(fileName).toBe("queue.db")
			expect(directory).toBe("/vault/queue")
			opened = new NodeSqlDatabase()
			return opened
		})

		expect(opened?.statements.slice(0, 3)).toEqual([
			`PRAGMA key = "x'${VALID_KEY}'"`,
			"PRAGMA secure_delete = ON",
			"PRAGMA foreign_keys = ON",
		])
		expect(await db.getFirstAsync<{ secure_delete: number }>("PRAGMA secure_delete", [])).toEqual({ secure_delete: 1 })
		expect(await db.getFirstAsync<{ foreign_keys: number }>("PRAGMA foreign_keys", [])).toEqual({ foreign_keys: 1 })
		expect(await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version", [])).toEqual({
			user_version: STORAGE_SCHEMA_VERSION,
		})
	})

	it("refuses a key that is not 32 raw bytes in hex", async () => {
		await expect(
			openEncryptedDatabase("queue", "secret", "/vault/queue", async () => new NodeSqlDatabase()),
		).rejects.toBeInstanceOf(DatabaseKeyInvalidError)
	})

	it("closes the database when keying fails", async () => {
		const failing = new NodeSqlDatabase()
		failing.execAsync = async () => {
			throw new Error("file is not a database")
		}
		let closed = false
		failing.closeAsync = async () => {
			closed = true
		}

		await expect(openEncryptedDatabase("viewing", VALID_KEY, "/vault/viewing", async () => failing)).rejects.toThrow(
			"file is not a database",
		)
		expect(closed).toBe(true)
	})

	it("names one database file per key domain", () => {
		expect(databaseFileName("queue")).toBe("queue.db")
		expect(databaseFileName("viewing")).toBe("viewing.db")
	})
})

async function schemaKilledAt(statementStart: string): Promise<NodeSqlDatabase> {
	const db = new NodeSqlDatabase()
	const execAsync = db.execAsync.bind(db)
	db.execAsync = async (source) => {
		if (source.trim().startsWith(statementStart)) {
			throw new Error("process killed")
		}
		await execAsync(source)
	}
	await expect(applyStorageSchema(db)).rejects.toThrow("process killed")
	db.execAsync = execAsync
	return db
}

async function userVersion(db: NodeSqlDatabase): Promise<number | undefined> {
	return (await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version", []))?.user_version
}

const VERSION_BEFORE_UNIQUE_POSITIONS = 2

describe("applyStorageSchema", () => {
	it("keeps every finished step when a later step is cut off and finishes on the next open", async () => {
		const db = await schemaKilledAt("CREATE UNIQUE INDEX")

		expect(await userVersion(db)).toBe(VERSION_BEFORE_UNIQUE_POSITIONS)
		expect(
			await db.getFirstAsync<{ name: string }>(
				"SELECT name FROM sqlite_master WHERE name = 'buffered_file_acquisition'",
				[],
			),
		).toEqual({ name: "buffered_file_acquisition" })

		await applyStorageSchema(db)

		expect(await userVersion(db)).toBe(STORAGE_SCHEMA_VERSION)
	})

	it("CAP-015-S04 numbers twin positions of a series before it makes them unique", async () => {
		const db = await schemaKilledAt("CREATE TEMP TABLE")
		const insertFile = "INSERT INTO stored_file (id, path, wrapped_key, created_at) VALUES (?, ?, 'key', 'now')"
		const insertBuffered = `INSERT INTO buffered_file (file_key, acquisition_id, operator_user_id, position,
			content_file_id, thumbnail_file_id, width, height, captured_at) VALUES (?, 'series', 'operator', ?, 'f', 'f', 1, 1, 'now')`
		await db.runAsync(insertFile, ["f", "/vault/queue/f"])
		for (const [fileKey, position] of [
			["a", 1],
			["b", 2],
			["c", 2],
			["d", 5],
		] as const) {
			await db.runAsync(insertBuffered, [fileKey, position])
		}

		await applyStorageSchema(db)

		expect(
			await db.getAllAsync<{ file_key: string; position: number }>(
				"SELECT file_key, position FROM buffered_file ORDER BY position",
				[],
			),
		).toEqual([
			{ file_key: "a", position: 1 },
			{ file_key: "b", position: 2 },
			{ file_key: "c", position: 3 },
			{ file_key: "d", position: 4 },
		])
	})
})

describe("upload columns", () => {
	it("CAP-019-R24 leaves photos buffered before the upload columns waiting to be sent", async () => {
		const db = await schemaKilledAt("ALTER TABLE buffered_file ADD COLUMN file_kind")
		await db.runAsync(
			"INSERT INTO stored_file (id, path, wrapped_key, created_at) VALUES ('f', '/vault/queue/f', 'key', 'now')",
			[],
		)
		await db.runAsync(
			`INSERT INTO buffered_file (file_key, acquisition_id, operator_user_id, position,
			content_file_id, thumbnail_file_id, width, height, captured_at) VALUES ('a', 'series', 'operator', 1, 'f', 'f', 1, 1, 'now')`,
			[],
		)

		await applyStorageSchema(db)

		expect(await userVersion(db)).toBe(STORAGE_SCHEMA_VERSION)
		expect(await db.getFirstAsync("SELECT file_kind, upload_state, original_file_id FROM buffered_file", [])).toEqual({
			file_kind: "image",
			upload_state: "waiting",
			original_file_id: null,
		})
	})
})

describe("queue records", () => {
	it("CAP-019-R29 CAP-019-S12 Q-076 keeps the files buffered before the queue records in their records", async () => {
		const db = await schemaKilledAt("CREATE TABLE queued_closure")
		await db.runAsync(
			"INSERT INTO stored_file (id, path, wrapped_key, created_at) VALUES ('f', '/vault/queue/f', 'key', 'now')",
			[],
		)
		await db.runAsync(
			`INSERT INTO buffered_file (file_key, acquisition_id, operator_user_id, position,
			content_file_id, thumbnail_file_id, width, height, captured_at) VALUES ('a', 'series', 'operator', 1, 'f', 'f', 1, 1, 'now')`,
			[],
		)

		await applyStorageSchema(db)

		expect(await userVersion(db)).toBe(STORAGE_SCHEMA_VERSION)
		expect(await db.getFirstAsync("SELECT removed_from_record_at, replaces_file_key FROM buffered_file", [])).toEqual({
			removed_from_record_at: null,
			replaces_file_key: null,
		})
		expect(
			(
				await db.getAllAsync<{ name: string }>(
					"SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (?, ?, ?, ?) ORDER BY name",
					["queued_closure", "queue_notice", "storage_loss", "storage_loss_acknowledgement"],
				)
			).map((table) => table.name),
		).toEqual(["queue_notice", "queued_closure", "storage_loss", "storage_loss_acknowledgement"])
	})
})

describe("SqlStoredFileRecords", () => {
	async function recordsOnFreshSchema(): Promise<{ db: NodeSqlDatabase; records: SqlStoredFileRecords }> {
		const db = new NodeSqlDatabase()
		await applyStorageSchema(db)
		return { db, records: new SqlStoredFileRecords(db) }
	}

	it("CAP-009-R17 adds the transfer buffer to a database of the first schema", async () => {
		const db = new NodeSqlDatabase()
		await db.execAsync(
			"CREATE TABLE stored_file (id TEXT PRIMARY KEY, path TEXT NOT NULL, wrapped_key TEXT NOT NULL, created_at TEXT NOT NULL)",
		)
		await db.execAsync("PRAGMA user_version = 1")

		await applyStorageSchema(db)

		expect(
			await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE name = 'buffered_file'", []),
		).toEqual({
			name: "buffered_file",
		})
	})

	it("applies the schema once", async () => {
		const { db } = await recordsOnFreshSchema()

		await applyStorageSchema(db)

		expect(await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version", [])).toEqual({
			user_version: STORAGE_SCHEMA_VERSION,
		})
	})

	it("inserts, finds and removes the wrapped key record of a file", async () => {
		const { records } = await recordsOnFreshSchema()
		const record = {
			id: "file-1",
			path: "/vault/queue/a",
			wrappedKey: "d3JhcHBlZA==",
			createdAt: "2026-09-21T10:00:00.000Z",
		}

		await records.insert(record)
		expect(await records.find("file-1")).toEqual(record)

		await records.remove("file-1")
		expect(await records.find("file-1")).toBeUndefined()
	})

	it("rejects a second record with the same id", async () => {
		const { records } = await recordsOnFreshSchema()
		const record = { id: "file-1", path: "/vault/queue/a", wrappedKey: "a", createdAt: "2026-09-21T10:00:00.000Z" }
		await records.insert(record)

		await expect(records.insert({ ...record, path: "/vault/queue/b" })).rejects.toThrow()
	})
})

describe("moment of receipt", () => {
	it("CAP-026-R08 dates the copies received before the update so their period runs from the update", async () => {
		const db = await schemaKilledAt("ALTER TABLE buffered_file ADD COLUMN received_at")
		await db.runAsync(
			"INSERT INTO stored_file (id, path, wrapped_key, created_at) VALUES ('f', '/vault/queue/f', 'key', 'now')",
			[],
		)
		const insertBuffered = `INSERT INTO buffered_file (file_key, acquisition_id, operator_user_id, position,
			content_file_id, thumbnail_file_id, width, height, captured_at, upload_state)
			VALUES (?, 'series', 'operator', ?, 'f', 'f', 1, 1, 'now', ?)`
		await db.runAsync(insertBuffered, ["received", 1, "received"])
		await db.runAsync(insertBuffered, ["waiting", 2, "waiting"])

		await applyStorageSchema(db)

		const rows = await db.getAllAsync<{ file_key: string; received_at: string | null }>(
			"SELECT file_key, received_at FROM buffered_file ORDER BY position",
			[],
		)
		expect(rows.map((row) => row.file_key)).toEqual(["received", "waiting"])
		expect(rows[0]?.received_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
		expect(rows[1]?.received_at).toBeNull()
	})
})
