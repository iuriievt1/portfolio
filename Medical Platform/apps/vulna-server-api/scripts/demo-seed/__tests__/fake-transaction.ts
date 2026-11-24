import type postgres from "@veevoy/postgres"

export interface FakeQuery {
	text: string
	values: unknown[]
}

export interface FakeHelper {
	helper: unknown
	columns: unknown[]
}

function isTemplate(value: unknown): value is TemplateStringsArray {
	return Array.isArray(value) && Object.hasOwn(value, "raw")
}

export function fakeTransaction(answer: (query: FakeQuery) => unknown[]) {
	const queries: FakeQuery[] = []
	const tx = (first: unknown, ...rest: unknown[]): Promise<unknown[]> | FakeHelper => {
		if (!isTemplate(first)) {
			return { helper: first, columns: rest }
		}
		const query = { text: first.join("?").replace(/\s+/g, " ").trim(), values: rest }
		queries.push(query)
		return Promise.resolve(answer(query))
	}
	return { tx: tx as unknown as postgres.TransactionSql, queries }
}
