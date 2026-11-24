import type { AuditSearchRow } from "../types/audit.types"

const SEPARATOR = ";"
const LINE_END = "\r\n"
const BYTE_ORDER_MARK = "\ufeff"
const QUOTE = '"'
const NEEDS_QUOTES = /[";\r\n]/
const FORMULA_START = /^[=+\-@\t\r]/
const FORMULA_GUARD = "'"

const COLUMNS: readonly (readonly [string, (row: AuditSearchRow) => string | null])[] = [
	["sequence", (row) => row.sequence],
	["time", (row) => row.occurred_at.toISOString()],
	["id", (row) => row.id],
	["actor_kind", (row) => row.actor_kind],
	["user_id", (row) => row.actor_user_id],
	["personal_number", (row) => row.personal_number],
	["user_name", (row) => row.display_name],
	["system_job", (row) => row.system_job],
	["device_id", (row) => row.actor_device_id],
	["session_id", (row) => row.session_id],
	["source_address", (row) => row.source_address],
	["event_type", (row) => row.event_type],
	["object_id", (row) => row.object_id],
	["outcome", (row) => row.outcome],
	["details", (row) => JSON.stringify(row.details)],
	["previous_hash", (row) => (row.previous_hash === "" ? null : row.previous_hash)],
	["hash", (row) => row.hash],
]

// OWASP CSV injection, RFC 4180
function cell(value: string | null): string {
	if (value === null) {
		return ""
	}
	const guarded = FORMULA_START.test(value) ? `${FORMULA_GUARD}${value}` : value
	return NEEDS_QUOTES.test(guarded) ? `${QUOTE}${guarded.replaceAll(QUOTE, QUOTE + QUOTE)}${QUOTE}` : guarded
}

function line(cells: readonly (string | null)[]): string {
	return `${cells.map(cell).join(SEPARATOR)}${LINE_END}`
}

export function csvHeader(): string {
	return `${BYTE_ORDER_MARK}${line(COLUMNS.map(([name]) => name))}`
}

// CAP-025-R23
export function csvLine(row: AuditSearchRow): string {
	return line(COLUMNS.map(([, valueIn]) => valueIn(row)))
}
