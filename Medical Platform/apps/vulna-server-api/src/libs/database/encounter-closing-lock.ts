import type postgres from "@veevoy/postgres"

// ADR-050, CAP-021-R11, backend.md 3 „Souběh“
const ENCOUNTER_CLOSING_LOCK = "encounter_closing"

export async function lockEncounterClosing(tx: postgres.TransactionSql, encounterId: string): Promise<void> {
	await tx`SELECT pg_advisory_xact_lock(hashtext(${`${ENCOUNTER_CLOSING_LOCK}:${encounterId}`})::bigint)`
}
