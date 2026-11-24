import { ROLE, type Role } from "@ansora/contracts"

export { ROLE, type Role }

export const ROLE_ORIGIN = {
	GROUP: "group",
	MANUAL: "manual",
} as const

export type RoleOrigin = (typeof ROLE_ORIGIN)[keyof typeof ROLE_ORIGIN]

export interface GroupToRole {
	group: string
	role: Role
}

export function isRole(value: unknown): value is Role {
	return Object.values(ROLE).includes(value as Role)
}

export function parseGroupToRoleMapping(value: unknown): GroupToRole[] {
	if (!Array.isArray(value)) {
		return []
	}
	const mapping: GroupToRole[] = []
	for (const item of value) {
		if (typeof item !== "object" || item === null) {
			continue
		}
		const { group, role } = item as Record<string, unknown>
		if (typeof group === "string" && group.length > 0 && isRole(role)) {
			mapping.push({ group, role })
		}
	}
	return mapping
}

export function groupsOf(claim: unknown): string[] {
	if (Array.isArray(claim)) {
		return claim.filter((item): item is string => typeof item === "string")
	}
	return typeof claim === "string" && claim.length > 0 ? [claim] : []
}

// CAP-001-R02, CAP-003-R04
export function isAuthorizedMember(groups: readonly string[], authorizedGroup: string | undefined): boolean {
	return authorizedGroup !== undefined && groups.includes(authorizedGroup)
}

export function rolesFromGroups(groups: readonly string[], mapping: readonly GroupToRole[]): Role[] {
	const roles = mapping.filter((entry) => groups.includes(entry.group)).map((entry) => entry.role)
	return sortedRoles(roles)
}

export function effectiveRoles(groupRoles: readonly Role[], manualRoles: readonly Role[]): Role[] {
	return sortedRoles([...groupRoles, ...manualRoles])
}

export function sameRoles(left: readonly Role[], right: readonly Role[]): boolean {
	const sortedLeft = sortedRoles(left)
	const sortedRight = sortedRoles(right)
	return sortedLeft.length === sortedRight.length && sortedLeft.every((role, index) => role === sortedRight[index])
}

function sortedRoles(roles: readonly Role[]): Role[] {
	return [...new Set(roles)].sort()
}
