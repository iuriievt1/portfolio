import { Injectable, type OnApplicationShutdown } from "@nestjs/common"
import postgres from "@veevoy/postgres"
import { EnvVariable } from "../common/constants/env-variable.constants"
import { EnvVariableService } from "../common/services/env-variable.service"

// ADR-005, ADR-021
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
	readonly sql: postgres.Sql

	constructor(env: EnvVariableService) {
		this.sql = postgres(env.get(EnvVariable.DATABASE_URL_WORKER), { onnotice: () => {} })
	}

	async onApplicationShutdown(): Promise<void> {
		await this.sql.end()
	}
}
