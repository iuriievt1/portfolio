import type { AuditTrailRecord } from "../audit/record"

export {
	AUDIT_OUTCOME,
	SYSLOG_FORMAT,
	SYSLOG_FRAMING,
	SYSLOG_TRANSPORT,
	type SyslogFormat,
	type SyslogFraming,
	type SyslogTransport,
} from "@ansora/contracts"

/**
 * An audit record.
 *
 * The audit trail is written **append-only** ✓ NAB-432; application roles hold neither UPDATE
 * nor DELETE on the audit tables ✓ NAB-433, ADR-021.
 */
export type AuditRecord = AuditTrailRecord

/**
 * Port `AuditSink` — export the audit trail ✓ ADR-003 ř. 21.
 *
 * In the MOÚ profile the `syslog` adapter implements it ✓ ADR-003 ř. 31, NAB-052, NAB-307.
 * **Only the worker process** calls it ✓ ADR-005 ř. 42.
 */
export interface AuditSinkPort {
	export(records: readonly AuditRecord[]): Promise<void>
}
