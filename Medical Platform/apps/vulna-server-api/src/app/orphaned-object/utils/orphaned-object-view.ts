import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { OrphanedObjectDeletion, OrphanedObjectRow, OrphanedObjectView } from "../types/orphaned-object.types"

// administration.yaml OrphanedObject
export function orphanedObjectViewOf(row: OrphanedObjectRow): OrphanedObjectView {
	return {
		id: row.id,
		size_bytes: Number(row.size_bytes),
		sha256: row.sha256,
		created_at: row.created_at.toISOString(),
		set_aside_at: row.set_aside_at.toISOString(),
	}
}

// CAP-026-S08, CAP-025-R03, datovy-model.md 8
export function orphanedObjectDeletionEventOf(deletion: OrphanedObjectDeletion): NewAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.ORPHANED_OBJECT_DELETION,
		actorKind: AUDIT_ACTOR_KIND.USER,
		actorUserId: deletion.administratorUserId,
		objectId: deletion.objectId,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: {
			binary_object_id: deletion.objectId,
			reason: deletion.reason,
			administrator_user_id: deletion.administratorUserId,
		},
	}
}
