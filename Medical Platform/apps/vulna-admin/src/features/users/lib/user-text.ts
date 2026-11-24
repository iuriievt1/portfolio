import type { Role } from "@ansora/contracts"
import type { User } from "@/features/users/types/user.types"
import cs from "@/i18n/cs.json"
import { fillText, formatList } from "@/lib/format"

export function rolesText(roles: User["roles"]): string {
	return roles.length === 0 ? cs.users.noRole : formatList(roles.map((role) => cs.users.role[role]))
}

export function sameRoles(left: readonly Role[], right: readonly Role[]): boolean {
	return left.length === right.length && left.every((role) => right.includes(role))
}

// CAP-003-R03
export function isManualOnly(role: Role, groupRoles: readonly Role[], manualRoles: readonly Role[]): boolean {
	return manualRoles.includes(role) && !groupRoles.includes(role)
}

// CAP-003-R03
export function userRolesText(user: User): string {
	if (user.roles.length === 0) {
		return cs.users.noRole
	}
	return formatList(
		user.roles.map((role) => {
			const name = cs.users.role[role]
			return isManualOnly(role, user.group_roles, user.manual_roles)
				? fillText(cs.users.manualOnlyRole, { role: name })
				: name
		}),
	)
}

export function departmentText(department: User["department"]): string {
	return department ?? cs.common.notStated
}
