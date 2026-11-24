import { ROLE_ORIGIN } from "@ansora/core-server"
import type { UserRoleRow } from "../types/login.types"
import type { RoleAssignment } from "../types/user-administration.types"

// CAP-003-R03, CAP-003-R12
export function roleAssignmentOf(rows: readonly UserRoleRow[]): RoleAssignment {
	return {
		group: rows.filter((row) => row.origin === ROLE_ORIGIN.GROUP).map((row) => row.role),
		manual: rows.filter((row) => row.origin === ROLE_ORIGIN.MANUAL).map((row) => row.role),
	}
}
