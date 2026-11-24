import type postgres from "@veevoy/postgres"

export interface FakeQuery {
	text: string
	values: unknown[]
}

export interface FakeHelper {
	helper: unknown
}

function isTemplate(value: unknown): value is TemplateStringsArray {
	return Array.isArray(value) && Object.hasOwn(value, "raw")
}

export function fakeSql(answer: (query: FakeQuery) => unknown[] = () => []) {
	const queries: FakeQuery[] = []
	const sql = (first: unknown, ...rest: unknown[]): Promise<unknown[]> | FakeHelper => {
		if (!isTemplate(first)) {
			return { helper: first }
		}
		const query = { text: first.join("?").replace(/\s+/g, " ").trim(), values: rest }
		queries.push(query)
		return Promise.resolve(answer(query))
	}
	const statementStartingWith = (prefix: string): FakeQuery => {
		const statement = queries.find((query) => query.text.startsWith(prefix))
		if (statement === undefined) {
			throw new Error(`No statement starts with ${prefix}`)
		}
		return statement
	}
	return { sql: sql as unknown as postgres.Sql & postgres.TransactionSql, queries, statementStartingWith }
}
