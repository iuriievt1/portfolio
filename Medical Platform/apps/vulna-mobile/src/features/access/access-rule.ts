import type { Session } from "@ansora/core-mobile"

// CAP-003-R05
export function hasRole(session: Session): boolean {
	return session.user.roles.length > 0
}
