import type { ConfigurationEntry } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../database/database.service"

// CAP-012-R19
@Injectable()
export class ConfigurationRepository {
	constructor(private readonly database: DatabaseService) {}

	async latestEntries(): Promise<ConfigurationEntry[]> {
		const rows = await this.database.sql<{ key: string; value: unknown }[]>`
			SELECT key, value FROM configuration
			WHERE version_id = (SELECT max(id) FROM configuration_version)
			ORDER BY key
		`
		return rows.map((row): ConfigurationEntry => [row.key, row.value])
	}
}
