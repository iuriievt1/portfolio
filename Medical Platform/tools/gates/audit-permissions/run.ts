import postgres from "@veevoy/postgres"
import {
	APPLICATION_ROLES,
	AUDIT_TABLE,
	AUDIT_TABLES,
	type ChangeAttempt,
	controlFindings,
	FORBIDDEN_PRIVILEGES,
	missingTableFindings,
	PUBLIC_GRANTEE,
	privilegeFindings,
	roleFindings,
	type TablePrivilege,
	triggerFindings,
} from "./audit-permissions"

const DATABASE_URL = process.env.AUDIT_GATE_DATABASE_URL
const SCHEMA = "public"
const CONTROL: TablePrivilege = { role: "vulna_api", table: AUDIT_TABLE, privilege: "UPDATE" }

const CHANGE_STATEMENTS: Readonly<Record<string, string>> = {
	UPDATE: `UPDATE ${AUDIT_TABLE} SET outcome = outcome`,
	DELETE: `DELETE FROM ${AUDIT_TABLE}`,
	TRUNCATE: `TRUNCATE ${AUDIT_TABLE}`,
}

class Rollback extends Error {}

async function inRolledBackTransaction(
	sql: postgres.Sql,
	work: (tx: postgres.TransactionSql) => Promise<void>,
): Promise<void> {
	try {
		await sql.begin(async (tx) => {
			await work(tx)
			throw new Rollback()
		})
	} catch (error) {
		if (!(error instanceof Rollback)) {
			throw error
		}
	}
}

async function presentTables(sql: postgres.Sql): Promise<string[]> {
	const rows = await sql<{ name: string }[]>`
		SELECT tablename AS name FROM pg_tables WHERE schemaname = ${SCHEMA} AND tablename = ANY(${AUDIT_TABLES})
	`
	return rows.map((row) => row.name)
}

// CAP-025-S10
async function grantedPrivileges(sql: postgres.Sql | postgres.TransactionSql): Promise<TablePrivilege[]> {
	return await sql<TablePrivilege[]>`
		SELECT r.rolname::text AS role, t.name AS table, p.name AS privilege
		FROM pg_roles r
		CROSS JOIN unnest(${AUDIT_TABLES}::text[]) AS t(name)
		CROSS JOIN unnest(${FORBIDDEN_PRIVILEGES}::text[]) AS p(name)
		WHERE NOT r.rolsuper
			AND NOT starts_with(r.rolname, 'pg_')
			AND has_table_privilege(r.oid, format('%I.%I', ${SCHEMA}::text, t.name), p.name)
		UNION ALL
		SELECT ${PUBLIC_GRANTEE}::text, c.relname::text, a.privilege_type
		FROM pg_class c
		CROSS JOIN aclexplode(c.relacl) AS a
		WHERE c.relnamespace = ${SCHEMA}::regnamespace
			AND c.relname = ANY(${AUDIT_TABLES})
			AND a.grantee = 0
			AND a.privilege_type = ANY(${FORBIDDEN_PRIVILEGES})
		ORDER BY 1, 2, 3
	`
}

async function tableOwner(sql: postgres.Sql): Promise<string> {
	const [row] = await sql<{ owner: string }[]>`
		SELECT tableowner AS owner FROM pg_tables WHERE schemaname = ${SCHEMA} AND tablename = ${AUDIT_TABLE}
	`
	if (row === undefined) {
		throw new Error(`table ${AUDIT_TABLE} has no owner`)
	}
	return row.owner
}

function failureOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

async function changeAttempts(tx: postgres.TransactionSql, actor: string): Promise<ChangeAttempt[]> {
	const attempts: ChangeAttempt[] = []
	for (const [statement, text] of Object.entries(CHANGE_STATEMENTS)) {
		const failure = await tx
			.savepoint((savepoint) => savepoint.unsafe(text))
			.then(
				() => undefined,
				(error: unknown) => failureOf(error),
			)
		attempts.push({ actor, table: AUDIT_TABLE, statement, failure })
	}
	return attempts
}

async function insertProbeRecord(tx: postgres.TransactionSql): Promise<void> {
	await tx`
		INSERT INTO ${tx(AUDIT_TABLE)}
			(id, occurred_at, event_type, actor_kind, system_job, outcome, details, sequence, previous_hash, hash)
		SELECT gen_random_uuid(), now(), 'b19-probe', 'system_job', 'audit_export', 'success', '{}'::jsonb,
			coalesce(max(sequence), 0) + 1, '', encode(sha256(gen_random_uuid()::text::bytea), 'hex')
		FROM ${tx(AUDIT_TABLE)}
	`
}

// CAP-025-S02
async function applicationRoleAttempts(sql: postgres.Sql): Promise<ChangeAttempt[]> {
	const attempts: ChangeAttempt[] = []
	for (const role of APPLICATION_ROLES) {
		await inRolledBackTransaction(sql, async (tx) => {
			await insertProbeRecord(tx)
			await tx`SELECT set_config('role', ${role}, true)`
			attempts.push(...(await changeAttempts(tx, `role ${role}`)))
		})
	}
	return attempts
}

// CAP-025-S12
async function ownerAttempts(sql: postgres.Sql): Promise<ChangeAttempt[]> {
	const owner = await tableOwner(sql)
	const attempts: ChangeAttempt[] = []
	await inRolledBackTransaction(sql, async (tx) => {
		await tx`SELECT set_config('role', ${owner}, true)`
		await tx`GRANT UPDATE, DELETE, TRUNCATE ON TABLE ${tx(AUDIT_TABLE)} TO ${tx(owner)}`
		await insertProbeRecord(tx)
		attempts.push(...(await changeAttempts(tx, `owner ${owner}`)))
	})
	return attempts
}

async function controlRun(sql: postgres.Sql): Promise<TablePrivilege[]> {
	let found: TablePrivilege[] = []
	await inRolledBackTransaction(sql, async (tx) => {
		await tx`GRANT UPDATE ON TABLE ${tx(CONTROL.table)} TO ${tx(CONTROL.role)}`
		found = await grantedPrivileges(tx)
	})
	return found
}

async function auditPermissionFindings(sql: postgres.Sql): Promise<string[]> {
	const missing = missingTableFindings(await presentTables(sql))
	if (missing.length > 0) {
		return missing
	}
	return [
		...privilegeFindings(await grantedPrivileges(sql)),
		...roleFindings(await applicationRoleAttempts(sql)),
		...triggerFindings(await ownerAttempts(sql)),
		...controlFindings(CONTROL, await controlRun(sql)),
	]
}

// B19, CAP-025-R19, CAP-025-R21
async function main(): Promise<void> {
	if (DATABASE_URL === undefined || DATABASE_URL === "") {
		throw new Error("Missing AUDIT_GATE_DATABASE_URL — B19 reads the migrated database as a superuser")
	}
	const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} })
	try {
		const findings = await auditPermissionFindings(sql)
		if (findings.length === 0) {
			process.stdout.write(
				`B19 audit privileges: clean — no role may ${FORBIDDEN_PRIVILEGES.join(", ")} on ${AUDIT_TABLES.join(", ")}, the application roles were refused and the trigger stopped the owner\n`,
			)
			return
		}
		process.stderr.write(`\nB19 audit privileges: ${findings.length} violations\n\n`)
		for (const finding of findings) {
			process.stderr.write(`  ${finding}\n`)
		}
		process.exitCode = 1
	} finally {
		await sql.end()
	}
}

main().catch((error: unknown) => {
	process.stderr.write(`B19 audit privileges failed: ${failureOf(error)}\n`)
	process.exitCode = 1
})
