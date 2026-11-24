import { describe, expect, it } from "vitest"
import { SerialSqlDatabase } from "../sql-database"
import { NodeSqlDatabase } from "./node-sql-database"

const CREATE_NOTE = "CREATE TABLE note (name TEXT PRIMARY KEY)"
const INSERT_NOTE = "INSERT INTO note (name) VALUES (?)"
const NAMES = "SELECT name FROM note ORDER BY name"

async function freshDatabase(): Promise<SerialSqlDatabase> {
	const db = new SerialSqlDatabase(new NodeSqlDatabase())
	await db.execAsync(CREATE_NOTE)
	return db
}

async function namesIn(db: SerialSqlDatabase): Promise<string[]> {
	return (await db.getAllAsync<{ name: string }>(NAMES, [])).map((row) => row.name)
}

describe("SerialSqlDatabase", () => {
	it("CAP-019-R24 keeps a statement sent during a transaction out of its rollback", async () => {
		const db = await freshDatabase()
		let release: () => void = () => undefined
		const held = new Promise<void>((resolve) => {
			release = resolve
		})

		const failed = db.transaction(async (transaction) => {
			await transaction.runAsync(INSERT_NOTE, ["moved"])
			await held
			throw new Error("the move failed")
		})
		const received = db.runAsync(INSERT_NOTE, ["received"])
		release()

		await expect(failed).rejects.toThrow("the move failed")
		await received
		expect(await namesIn(db)).toEqual(["received"])
	})

	it("CAP-018-S10 runs two transactions one after the other", async () => {
		const db = await freshDatabase()

		await Promise.all([
			db.transaction(async (transaction) => {
				await transaction.runAsync(INSERT_NOTE, ["first"])
			}),
			db.transaction(async (transaction) => {
				await transaction.runAsync(INSERT_NOTE, ["second"])
			}),
		])

		expect(await namesIn(db)).toEqual(["first", "second"])
	})

	it("goes on after a statement failed", async () => {
		const db = await freshDatabase()

		await expect(db.runAsync("INSERT INTO missing (name) VALUES (?)", ["lost"])).rejects.toThrow()
		await db.runAsync(INSERT_NOTE, ["kept"])

		expect(await namesIn(db)).toEqual(["kept"])
	})
})
