import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const SQL_EXTENSION = ".sql"
const PERMISSION_CHECK = /CHECK\s*\(\s*permission\s+IN\s*\(([^)]*)\)/gi
const PERMISSION_SEED = /INSERT\s+INTO\s+role_permission\s*\([^)]*\)\s*VALUES([^;]*);/gi
const QUOTED_VALUE = /'([^']*)'/g
const SEED_ROW = /\(\s*'[^']*'\s*,\s*'([^']*)'\s*\)/g

export function readMigrations(directory: string): string[] {
	return readdirSync(directory)
		.filter((name) => name.endsWith(SQL_EXTENSION))
		.sort()
		.map((name) => readFileSync(join(directory, name), "utf8"))
}

// CAP-029-R33, CAP-003-R13
export function catalogFindings(catalog: readonly string[], migrations: readonly string[]): string[] {
	const allowed = allowedPermissions(migrations)
	if (allowed === undefined) {
		return ["no migration limits role_permission.permission to the catalog"]
	}
	return [
		...allowed
			.filter((permission) => !catalog.includes(permission))
			.map((permission) => `the database allows ${permission}, which the catalog does not know`),
		...catalog
			.filter((permission) => !allowed.includes(permission))
			.map((permission) => `the catalog has ${permission}, which the database does not allow`),
		...seededPermissions(migrations)
			.filter((permission) => !catalog.includes(permission))
			.map((permission) => `a migration seeds ${permission}, which the catalog does not know`),
	]
}

function allowedPermissions(migrations: readonly string[]): string[] | undefined {
	let allowed: string[] | undefined
	for (const sql of migrations) {
		for (const match of sql.matchAll(PERMISSION_CHECK)) {
			allowed = valuesOf(match[1] ?? "", QUOTED_VALUE)
		}
	}
	return allowed
}

function seededPermissions(migrations: readonly string[]): string[] {
	return migrations.flatMap((sql) =>
		[...sql.matchAll(PERMISSION_SEED)].flatMap((match) => valuesOf(match[1] ?? "", SEED_ROW)),
	)
}

function valuesOf(text: string, pattern: RegExp): string[] {
	return [...text.matchAll(pattern)].map((match) => match[1] ?? "")
}
