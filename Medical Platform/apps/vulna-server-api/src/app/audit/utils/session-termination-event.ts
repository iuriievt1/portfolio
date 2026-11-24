import { AUDIT_SCOPE } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME, type SessionEndReason } from "@ansora/core-server"
import type { UserSession } from "../../login/types/login.types"
import type { NewAuditEvent } from "../types/audit.types"

// CAP-002-R11
export function sessionTerminationEventOf(
	session: Pick<UserSession, "id" | "userId" | "deviceId">,
	reason: SessionEndReason,
): NewAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.SESSION_TERMINATION,
		actorKind: AUDIT_ACTOR_KIND.USER,
		actorUserId: session.userId,
		actorDeviceId: session.deviceId,
		sessionId: session.id,
		objectId: session.id,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: { scope: AUDIT_SCOPE.MOBILE, reason },
	}
}
