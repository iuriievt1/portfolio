import type { KeyDomain } from "../native"
import type { SqlDatabase, SqlDatabaseOpener } from "./sql-database"
import { applyStorageSchema } from "./storage-schema"

const RAW_KEY_PATTERN = /^[0-9a-f]{64}$/

export class DatabaseKeyInvalidError extends Error {
	readonly code = "database-key-invalid"

	constructor() {
		super("The database key must be 32 bytes in lowercase hex")
		this.name = "DatabaseKeyInvalidError"
	}
}

export function databaseFileName(domain: KeyDomain): string {
	return `${domain}.db`
}

export async function openEncryptedDatabase(
	domain: KeyDomain,
	key: string,
	directory: string,
	open: SqlDatabaseOpener,
): Promise<SqlDatabase> {
	if (!RAW_KEY_PATTERN.test(key)) {
		throw new DatabaseKeyInvalidError()
	}
	const db = await open(databaseFileName(domain), directory)
	try {
		await db.execAsync(`PRAGMA key = "x'${key}'"`)
		await db.execAsync("PRAGMA secure_delete = ON")
		await db.execAsync("PRAGMA foreign_keys = ON")
		await verifyKeyOpensDatabase(db)
		await applyStorageSchema(db)
	} catch (failure) {
		await db.closeAsync()
		throw failure
	}
	return db
}

async function verifyKeyOpensDatabase(db: SqlDatabase): Promise<void> {
	await db.getFirstAsync("SELECT count(*) AS tables FROM sqlite_master", [])
}
