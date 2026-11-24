import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { CURRENT_BODY_DIAGRAM } from "@ansora/vulna-domain"
import postgres from "@veevoy/postgres"
import { bodyDiagramDigest } from "./body-diagram-digest"
import { readProfileCodeLists, writeCodeLists } from "./initial-code-lists"
import { readProfileDefaults, writeInitialConfiguration } from "./initial-configuration"
import { SCHEMA_VERSION_RANGE } from "./schema-version-range"

/**
 * The migration step ✓ ADR-021.
 *
 * Migrations are **SQL versioned in the repository** and applied by this separate step, built
 * from the same image and the same tagged revision, which runs **before both processes start**
 * and finishes before they do ✓ ADR-021, NAB-469.
 *
 * The step uses the **migration role** — the only role allowed to change the schema (DDL).
 * A running process never holds DDL; if it did, it could drop the audit table ✓ ADR-021,
 * NAB-464, NAB-433.
 *
 * The step is **idempotent** and its outcome belongs in the release record together with the
 * image digest and the gate results ✓ ADR-021, MDR opatření M2.
 *
 * A migration **carries no data**: seed code lists are loaded as data during installation
 * ✓ NAB-529, ADR-023. A migration **never changes or deletes audit records** ✓ NAB-432, NAB-433.
 */

const MIGRATIONS_DIRECTORY = resolve(__dirname, "../../../db/migrations")

interface Migration {
	order: number
	name: string
	file: string
	sql: string
	checksum: string
}

async function loadMigrations(): Promise<Migration[]> {
	const files = (await readdir(MIGRATIONS_DIRECTORY)).filter((f) => f.endsWith(".sql")).sort()

	const migrations: Migration[] = []
	for (const file of files) {
		const match = /^(\d{4})-(.+)\.sql$/.exec(file)
		if (match === null) {
			throw new Error(`Migration file name does not match NNNN-name.sql: ${file}`)
		}
		const sql = await readFile(join(MIGRATIONS_DIRECTORY, file), "utf8")
		migrations.push({
			order: Number(match[1]),
			name: match[2] as string,
			file,
			sql,
			checksum: createHash("sha256").update(sql).digest("hex"),
		})
	}
	return migrations
}

async function ensureVersionTable(sql: postgres.Sql): Promise<void> {
	await sql`
		CREATE TABLE IF NOT EXISTS schema_version (
			sequence    integer      PRIMARY KEY,
			name        text         NOT NULL,
			checksum    text         NOT NULL,
			applied_at  timestamptz  NOT NULL DEFAULT now()
		)
	`
}

/**
 * The image declares the **range** of schema versions it can run against and refuses to run only
 * against a schema outside that range ✓ ADR-021. Checking for a single exact version would close
 * off the rollback path for every migration.
 */
function checkRange(highestInRepository: number): void {
	const { lowest, highest } = SCHEMA_VERSION_RANGE
	if (highestInRepository < lowest || highestInRepository > highest) {
		throw new Error(
			`Schema version ${highestInRepository} is outside this image's range <${lowest}, ${highest}>. ` +
				"The range is updated in src/schema-version-range.ts together with the migration ✓ ADR-021.",
		)
	}
}

async function migrate(): Promise<void> {
	const url = process.env.DATABASE_URL_MIGRATE
	if (url === undefined || url === "") {
		throw new Error("Missing DATABASE_URL_MIGRATE — the migration step runs under the migration role ✓ ADR-021.")
	}

	const migrations = await loadMigrations()
	if (migrations.length > 0) {
		checkRange(migrations.at(-1)?.order ?? 0)
	}

	const sql = postgres(url, { max: 1, onnotice: () => {} })
	try {
		await ensureVersionTable(sql)
		const applied = await sql<{ sequence: number; checksum: string }[]>`SELECT sequence, checksum FROM schema_version`
		const checksumByOrder = new Map(applied.map((row) => [row.sequence, row.checksum]))

		for (const migration of migrations) {
			const checksum = checksumByOrder.get(migration.order)
			if (checksum === migration.checksum) {
				continue
			}
			if (checksum !== undefined) {
				throw new Error(
					`Migration ${migration.file} changed after it was applied (${checksum} vs ${migration.checksum}). ` +
						"An applied migration is never rewritten — write a new one ✓ ADR-021.",
				)
			}

			await sql.begin(async (tx) => {
				await tx.unsafe(migration.sql)
				await tx`
					INSERT INTO schema_version (sequence, name, checksum)
					VALUES (${migration.order}, ${migration.name}, ${migration.checksum})
				`
			})
			process.stdout.write(`applied ${migration.file}\n`)
		}

		const written = await writeInitialConfiguration(sql, await readProfileDefaults())
		process.stdout.write(
			written ? "configuration version 1 written from the profile defaults\n" : "configuration already has a version\n",
		)
		const codeLists = await writeCodeLists(sql, await readProfileCodeLists(), {
			version: CURRENT_BODY_DIAGRAM.version,
			digest: bodyDiagramDigest(CURRENT_BODY_DIAGRAM),
		})
		process.stdout.write(
			codeLists.addedLists.length === 0
				? "code lists already exist\n"
				: `code lists ${codeLists.addedLists.join(", ")} written from the profile\n`,
		)
		process.stdout.write(
			codeLists.codeListSetVersion === undefined
				? "code list set is current\n"
				: `code list set version ${codeLists.codeListSetVersion} written and queued for the clinical record\n`,
		)
		process.stdout.write(`migration step finished, schema version ${migrations.at(-1)?.order ?? 0}\n`)
	} finally {
		await sql.end()
	}
}

migrate().catch((error: unknown) => {
	process.stderr.write(`migration step failed: ${String(error)}\n`)
	process.exitCode = 1
})
