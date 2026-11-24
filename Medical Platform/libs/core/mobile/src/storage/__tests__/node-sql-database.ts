import { DatabaseSync } from "node:sqlite"
import type { SqlBindValue, SqlDatabase } from "../sql-database"

export class NodeSqlDatabase implements SqlDatabase {
	readonly statements: string[] = []
	private readonly db = new DatabaseSync(":memory:", { enableForeignKeyConstraints: false })

	async execAsync(source: string): Promise<void> {
		this.statements.push(source.trim())
		this.db.exec(source)
	}

	async runAsync(source: string, params: SqlBindValue[]): Promise<unknown> {
		return this.db.prepare(source).run(...params)
	}

	async getFirstAsync<Row>(source: string, params: SqlBindValue[]): Promise<Row | null> {
		return (this.db.prepare(source).get(...params) as Row | undefined) ?? null
	}

	async getAllAsync<Row>(source: string, params: SqlBindValue[]): Promise<Row[]> {
		return this.db.prepare(source).all(...params) as Row[]
	}

	async closeAsync(): Promise<void> {
		this.db.close()
	}
}
