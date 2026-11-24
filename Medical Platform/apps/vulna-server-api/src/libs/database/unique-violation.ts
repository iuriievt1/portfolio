import postgres from "@veevoy/postgres"

const UNIQUE_VIOLATION = "23505"

export function isUniqueViolation(error: unknown): boolean {
	return error instanceof postgres.PostgresError && error.code === UNIQUE_VIOLATION
}
