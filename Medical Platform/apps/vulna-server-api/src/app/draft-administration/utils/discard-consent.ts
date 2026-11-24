import { MILLISECONDS_PER_SECOND } from "@ansora/core-server"
import type { OperatorPresenceRow } from "../types/draft-administration.types"

// CAP-015-R19, CAP-015-S20, datovy-model.md 4
export function isDiscardConsentAllowed(presence: OperatorPresenceRow, absenceSeconds: number, now: Date): boolean {
	if (!presence.is_active) {
		return true
	}
	if (presence.has_active_session) {
		return false
	}
	if (presence.last_login_at === null) {
		return true
	}
	return now.getTime() - presence.last_login_at.getTime() > absenceSeconds * MILLISECONDS_PER_SECOND
}
