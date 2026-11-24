export type SqlBindValue = string | number | null

export interface SqlDatabase {
	execAsync(source: string): Promise<void>
	runAsync(source: string, params: SqlBindValue[]): Promise<unknown>
	getFirstAsync<Row>(source: string, params: SqlBindValue[]): Promise<Row | null>
	getAllAsync<Row>(source: string, params: SqlBindValue[]): Promise<Row[]>
	closeAsync(): Promise<void>
}

export type SqlDatabaseOpener = (fileName: string, directory: string) => Promise<SqlDatabase>

// CAP-009-R17, CAP-019-R24
export interface TransactionalSqlDatabase extends SqlDatabase {
	transaction<Result>(work: (transaction: SqlDatabase) => Promise<Result>): Promise<Result>
}

const BEGIN = "BEGIN"
const COMMIT = "COMMIT"
const ROLLBACK = "ROLLBACK"

// CAP-009-R17, CAP-019-R24
export class SerialSqlDatabase implements TransactionalSqlDatabase {
	private queue: Promise<unknown> = Promise.resolve()

	constructor(private readonly db: SqlDatabase) {}

	execAsync(source: string): Promise<void> {
		return this.inTurn(() => this.db.execAsync(source))
	}

	runAsync(source: string, params: SqlBindValue[]): Promise<unknown> {
		return this.inTurn(() => this.db.runAsync(source, params))
	}

	getFirstAsync<Row>(source: string, params: SqlBindValue[]): Promise<Row | null> {
		return this.inTurn(() => this.db.getFirstAsync<Row>(source, params))
	}

	getAllAsync<Row>(source: string, params: SqlBindValue[]): Promise<Row[]> {
		return this.inTurn(() => this.db.getAllAsync<Row>(source, params))
	}

	closeAsync(): Promise<void> {
		return this.inTurn(() => this.db.closeAsync())
	}

	transaction<Result>(work: (transaction: SqlDatabase) => Promise<Result>): Promise<Result> {
		return this.inTurn(async () => {
			await this.db.execAsync(BEGIN)
			try {
				const result = await work(this.db)
				await this.db.execAsync(COMMIT)
				return result
			} catch (failure) {
				await this.db.execAsync(ROLLBACK)
				throw failure
			}
		})
	}

	private inTurn<Result>(work: () => Promise<Result>): Promise<Result> {
		const turn = this.queue.then(work)
		this.queue = turn.catch(() => undefined)
		return turn
	}
}
