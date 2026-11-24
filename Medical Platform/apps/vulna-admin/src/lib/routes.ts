// architektura.md 2
export const ROUTES = {
	ROOT: "/",
	ALERTS: "alerts",
	DRAFTS: "drafts",
	ACQUISITIONS: "acquisitions",
	ACQUISITION: ":acquisitionId",
	DELIVERIES: "deliveries",
	DELIVERY: ":deliveryId",
	DEVICES: "devices",
	USERS: "users",
	USER: ":userId",
	DEVICE: ":deviceId",
	DEVICE_GROUPS: "device-groups",
	DEVICE_GROUP: ":groupId",
	CARDS: "cards",
	CONFIGURATION: "configuration",
	CODE_LISTS: "code-lists",
	CODE_LIST: ":codeListCode",
	AUDIT: "audit",
	ORPHANED_OBJECTS: "orphaned-objects",
} as const

export function userPagePath(userId: string): string {
	return `/${ROUTES.USERS}/${encodeURIComponent(userId)}`
}

export function userCardsPagePath(userId: string): string {
	return `${userPagePath(userId)}/${ROUTES.CARDS}`
}

export function devicePagePath(deviceId: string): string {
	return `/${ROUTES.DEVICES}/${encodeURIComponent(deviceId)}`
}

export function codeListPagePath(codeListCode: string): string {
	return `/${ROUTES.CODE_LISTS}/${encodeURIComponent(codeListCode)}`
}

export function deviceGroupPagePath(groupId: string): string {
	return `/${ROUTES.DEVICE_GROUPS}/${encodeURIComponent(groupId)}`
}

export function acquisitionsPagePath(): string {
	return `/${ROUTES.ACQUISITIONS}`
}

export function draftsPagePath(): string {
	return `/${ROUTES.DRAFTS}`
}

export function devicesPagePath(): string {
	return `/${ROUTES.DEVICES}`
}

export function deviceGroupsPagePath(): string {
	return `/${ROUTES.DEVICE_GROUPS}`
}

export function acquisitionPagePath(acquisitionId: string): string {
	return `/${ROUTES.ACQUISITIONS}/${encodeURIComponent(acquisitionId)}`
}

export function deliveriesPagePath(): string {
	return `/${ROUTES.DELIVERIES}`
}

export function deliveryPagePath(deliveryId: string): string {
	return `${deliveriesPagePath()}/${encodeURIComponent(deliveryId)}`
}

// DESIGN.md 9.1
export function configurationPagePath(tab: string, section: string): string {
	return `/${ROUTES.CONFIGURATION}?${new URLSearchParams({ tab })}#${encodeURIComponent(section)}`
}

export function auditPagePath(): string {
	return `/${ROUTES.AUDIT}`
}

export function alertsPagePath(): string {
	return `/${ROUTES.ALERTS}`
}

// CAP-026-R14, administration.yaml listOrphanedObjects
export function orphanedObjectsPagePath(): string {
	return `/${ROUTES.ORPHANED_OBJECTS}`
}
