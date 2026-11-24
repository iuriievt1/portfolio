import type { ConfigurationEntry } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { isUniqueViolation } from "../../../libs/database/unique-violation"
import { ConfigurationVersionConflictError } from "../errors/configuration-version-conflict.error"
import type {
	ConfigurationValueRow,
	ConfigurationVersionRow,
	NewConfigurationVersion,
	StoredConfiguration,
} from "../types/configuration.types"

async function insertVersionRow(
	tx: postgres.TransactionSql,
	next: NewConfigurationVersion,
): Promise<ConfigurationVersionRow> {
	try {
		const [row] = await tx<ConfigurationVersionRow[]>`
			INSERT INTO configuration_version (id, author_user_id, reason)
			VALUES (${next.version}, ${next.authorUserId}, ${next.reason})
			RETURNING id, created_at, author_user_id, reason
		`
		if (row === undefined) {
			throw new Error(`inserting configuration version ${next.version} returned no row`)
		}
		return row
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new ConfigurationVersionConflictError(next.version)
		}
		throw error
	}
}

function stored(version: ConfigurationVersionRow, entries: ConfigurationEntry[]): StoredConfiguration {
	return {
		version: version.id,
		createdAt: version.created_at,
		authorUserId: version.author_user_id,
		reason: version.reason,
		entries,
	}
}

@Injectable()
export class ConfigurationRepository {
	constructor(private readonly database: DatabaseService) {}

	async latest(): Promise<StoredConfiguration | undefined> {
		const [version] = await this.database.sql<ConfigurationVersionRow[]>`
			SELECT id, created_at, author_user_id, reason FROM configuration_version ORDER BY id DESC LIMIT 1
		`
		if (version === undefined) {
			return undefined
		}
		const rows = await this.database.sql<ConfigurationValueRow[]>`
			SELECT key, value FROM configuration WHERE version_id = ${version.id} ORDER BY key
		`
		return stored(
			version,
			rows.map((row): ConfigurationEntry => [row.key, row.value]),
		)
	}

	async insertVersion(tx: postgres.TransactionSql, next: NewConfigurationVersion): Promise<StoredConfiguration> {
		const version = await insertVersionRow(tx, next)
		for (const [key, value] of next.entries) {
			await tx`
				INSERT INTO configuration (version_id, key, value)
				VALUES (${next.version}, ${key}, ${JSON.stringify(value)}::text::jsonb)
			`
		}
		return stored(version, [...next.entries])
	}
}
