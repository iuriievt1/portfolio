// CAP-003-R13, CAP-029-R33
export const PERMISSION = {
	ADMINISTRATION_ACCESS: "administration.access",
	USERS_MANAGE: "users.manage",
	CREDENTIALS_MANAGE: "credentials.manage",
	DEVICES_MANAGE: "devices.manage",
	CONFIGURATION_MANAGE: "configuration.manage",
	AUDIT_READ: "audit.read",
	AUDIT_EXPORT: "audit.export",
	// CAP-021-R27
	MONITORING_MANAGE: "monitoring.manage",
	// CAP-004-R14, CAP-015-R19
	DRAFTS_MANAGE: "drafts.manage",
	// CAP-004-R10, CAP-025-R28
	ACQUISITIONS_READ: "acquisitions.read",
} as const

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION]

export const PERMISSIONS: readonly Permission[] = Object.values(PERMISSION)

export function isPermission(value: string): value is Permission {
	return PERMISSIONS.includes(value as Permission)
}
