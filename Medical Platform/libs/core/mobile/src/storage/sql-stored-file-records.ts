import type { StoredFile, StoredFileRecords } from "./encrypted-file-store"
import type { SqlDatabase } from "./sql-database"

interface StoredFileRow {
	id: string
	path: string
	wrapped_key: string
	created_at: string
}

export class SqlStoredFileRecords implements StoredFileRecords {
	constructor(private readonly db: SqlDatabase) {}

	async insert(record: StoredFile): Promise<void> {
		await this.db.runAsync("INSERT INTO stored_file (id, path, wrapped_key, created_at) VALUES (?, ?, ?, ?)", [
			record.id,
			record.path,
			record.wrappedKey,
			record.createdAt,
		])
	}

	async find(id: string): Promise<StoredFile | undefined> {
		const row = await this.db.getFirstAsync<StoredFileRow>(
			"SELECT id, path, wrapped_key, created_at FROM stored_file WHERE id = ?",
			[id],
		)
		if (!row) {
			return undefined
		}
		return { id: row.id, path: row.path, wrappedKey: row.wrapped_key, createdAt: row.created_at }
	}

	async remove(id: string): Promise<void> {
		await this.db.runAsync("DELETE FROM stored_file WHERE id = ?", [id])
	}
}
