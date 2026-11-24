// CAP-025-R01, CAP-025-R19
export const AUDIT_TABLE = "audit"
export const AUDIT_TABLES: readonly string[] = [AUDIT_TABLE]
export const FORBIDDEN_PRIVILEGES: readonly string[] = ["UPDATE", "DELETE", "TRUNCATE"]
export const PUBLIC_GRANTEE = "PUBLIC"
export const APPLICATION_ROLES: readonly string[] = ["vulna_api", "vulna_worker"]
export const PERMISSION_DENIED_MESSAGE = `permission denied for table ${AUDIT_TABLE}`

// 0003-audit-chain.sql audit_reject_change
export const TRIGGER_MESSAGE = "audit is append-only"

export interface TablePrivilege {
	role: string
	table: string
	privilege: string
}

export interface ChangeAttempt {
	actor: string
	table: string
	statement: string
	failure: string | undefined
}

export function missingTableFindings(present: readonly string[]): string[] {
	return AUDIT_TABLES.filter((table) => !present.includes(table)).map(
		(table) => `table ${table} does not exist after the migrations`,
	)
}

// CAP-025-S10
export function privilegeFindings(granted: readonly TablePrivilege[]): string[] {
	return granted.map((grant) => `role ${grant.role} has ${grant.privilege} on table ${grant.table}`)
}

function attemptFindings(attempts: readonly ChangeAttempt[], expected: string, stopper: string): string[] {
	return attempts
		.filter((attempt) => attempt.failure !== expected)
		.map((attempt) =>
			attempt.failure === undefined
				? `${attempt.actor} ran ${attempt.statement} on table ${attempt.table} and no ${stopper} stopped it`
				: `${attempt.actor} ran ${attempt.statement} on table ${attempt.table} and it failed with "${attempt.failure}" instead of the ${stopper}`,
		)
}

// CAP-025-S02
export function roleFindings(attempts: readonly ChangeAttempt[]): string[] {
	return attemptFindings(attempts, PERMISSION_DENIED_MESSAGE, "missing privilege")
}

// CAP-025-S12
export function triggerFindings(attempts: readonly ChangeAttempt[]): string[] {
	return attemptFindings(attempts, TRIGGER_MESSAGE, "trigger")
}

export function controlFindings(control: TablePrivilege, found: readonly TablePrivilege[]): string[] {
	const noticed = found.some(
		(grant) => grant.role === control.role && grant.table === control.table && grant.privilege === control.privilege,
	)
	return noticed ? [] : [`the check missed ${control.privilege} granted to ${control.role} on table ${control.table}`]
}
