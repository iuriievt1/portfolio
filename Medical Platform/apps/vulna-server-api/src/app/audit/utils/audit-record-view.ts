import type { SystemJob } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE } from "@ansora/core-server"
import type { AuditSearchRow } from "../types/audit.types"
import type { AuditRecordView } from "../types/audit-administration.types"
import { eventFieldsOf } from "./audit-record-fields"

const APPROVAL_EVENTS: ReadonlySet<string> = new Set([
	AUDIT_EVENT_TYPE.DEVICE_APPROVAL,
	AUDIT_EVENT_TYPE.DEVICE_APPROVAL_REJECTED,
])

function userIdentity(row: AuditSearchRow): string | null {
	if (row.actor_user_id === null) {
		return null
	}
	if (row.display_name !== null && row.personal_number !== null) {
		return `${row.display_name} (${row.personal_number})`
	}
	return row.personal_number ?? row.display_name ?? row.actor_user_id
}

function text(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined
}

// CAP-006-R16
function deviceApproval(row: AuditSearchRow): AuditRecordView["device_approval"] {
	const fingerprint = text(row.details.fingerprint)
	const requester = text(row.details.requester_user_id)
	const administrator = text(row.details.administrator_user_id) ?? row.actor_user_id ?? undefined
	if (
		!APPROVAL_EVENTS.has(row.event_type) ||
		fingerprint === undefined ||
		requester === undefined ||
		administrator === undefined
	) {
		return null
	}
	return {
		fingerprint,
		requester_user_id: requester,
		administrator_user_id: administrator,
		blocked_predecessor_hw_id: text(row.details.blocked_predecessor_hw_id) ?? null,
	}
}

// CAP-025-R04, CAP-025-R23, administration.yaml AuditRecord.details
export function auditRecordView(row: AuditSearchRow): AuditRecordView {
	const view: AuditRecordView = {
		id: row.id,
		time: row.occurred_at.toISOString(),
		user: userIdentity(row),
		system_job: row.system_job as SystemJob | null,
		event_type: row.event_type,
		outcome: row.outcome,
		session_id: row.session_id,
		details: null,
		device_approval: deviceApproval(row),
		previous_hash: row.previous_hash === "" ? null : row.previous_hash,
		hash: row.hash,
		...eventFieldsOf(row),
	}
	if (row.actor_device_id !== null) {
		view.device = row.actor_device_id
	}
	if (row.source_address !== null) {
		view.source_address = row.source_address
	}
	return view
}
