import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { configurationEntries, PROFILE_ARTIFACT } from "@ansora/core-server"
import type postgres from "@veevoy/postgres"

const DEFAULTS_FILE = resolve(__dirname, "../../../dist/profile", PROFILE_ARTIFACT.CONFIGURATION_DEFAULTS)
const INITIAL_VERSION = 1
const INITIAL_REASON = "Výchozí hodnoty podepsaného profilu"

export async function readProfileDefaults(): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(DEFAULTS_FILE, "utf8")) as Record<string, unknown>
}

export async function writeInitialConfiguration(
	sql: postgres.Sql,
	defaults: Record<string, unknown>,
): Promise<boolean> {
	const entries = configurationEntries(defaults)
	return await sql.begin(async (tx) => {
		const [existing] = await tx<{ count: number }[]>`SELECT count(*)::int AS count FROM configuration_version`
		if ((existing?.count ?? 0) > 0) {
			return false
		}
		await tx`
			INSERT INTO configuration_version (id, author_user_id, reason)
			VALUES (${INITIAL_VERSION}, NULL, ${INITIAL_REASON})
		`
		for (const [key, value] of entries) {
			await tx`
				INSERT INTO configuration (version_id, key, value)
				VALUES (${INITIAL_VERSION}, ${key}, ${JSON.stringify(value)}::text::jsonb)
			`
		}
		return true
	})
}
