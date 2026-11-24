import postgres from "@veevoy/postgres"
import { SyntheticPacs } from "../pacs/synthetic-pacs"
import { type SystemEnvironment, systemEnvironment } from "./environment"

// ADR-024
const DATABASE_CONNECTIONS = 2

export interface SystemContext {
	environment: SystemEnvironment
	sql: postgres.Sql
	pacs: SyntheticPacs
	close(): Promise<void>
}

export function systemContext(): SystemContext {
	const environment = systemEnvironment()
	const sql = postgres(environment.databaseUrl, { max: DATABASE_CONNECTIONS, onnotice: () => {} })
	return {
		environment,
		sql,
		pacs: new SyntheticPacs(environment.orthancUrl, environment.orthancUser, environment.orthancPassword),
		close: async () => {
			await sql.end()
		},
	}
}
