import { AUDIT_ACTOR_KIND } from "@ansora/core-server"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import type { AuditActor } from "../types/audit.types"

// CAP-025-R04, CAP-004-R09
export function administratorActorOf(administrator: AdministrationSession): AuditActor {
	return (event) => ({ ...event, actorKind: AUDIT_ACTOR_KIND.USER, actorUserId: administrator.userId })
}

// CAP-025-R28
export function administratorSessionActorOf(administrator: AdministrationSession): AuditActor {
	const actor = administratorActorOf(administrator)
	return (event) => ({ ...actor(event), sessionId: administrator.sessionId })
}
