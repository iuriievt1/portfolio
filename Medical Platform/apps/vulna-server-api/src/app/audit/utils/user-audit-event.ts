import { AUDIT_ACTOR_KIND } from "@ansora/core-server"
import type { CurrentSession } from "../../login/types/login.types"
import type { AuditActor, NewAuditEvent, UserAuditEvent } from "../types/audit.types"

// CAP-025-R04
export function userAuditEventOf(current: CurrentSession, event: UserAuditEvent): NewAuditEvent {
	return {
		...event,
		actorKind: AUDIT_ACTOR_KIND.USER,
		actorUserId: current.session.userId,
		actorDeviceId: current.device.id,
		sessionId: current.session.id,
	}
}

// CAP-025-R04
export function sessionActorOf(current: CurrentSession): AuditActor {
	return (event) => userAuditEventOf(current, event)
}
