import type { AdministrationContract } from "@ansora/contracts"

type Schemas = AdministrationContract.components["schemas"]

export type OrphanedObjectView = Schemas["OrphanedObject"]

export type OrphanedObjectsPageView = Schemas["OrphanedObjectsPage"]

// datovy-model.md 4 „Binární objekt“
export interface OrphanedObjectRow {
	id: string
	size_bytes: string
	sha256: string
	created_at: Date
	set_aside_at: Date
	cursor_moment: string
}

// CAP-026-R14, CAP-026-S08
export interface LockedObjectRow {
	id: string
	set_aside_at: Date | null
	is_unreferenced: boolean
}

export interface OrphanedObjectQuery {
	limit: number
	cursor: string | undefined
}

// CAP-026-S08, datovy-model.md 8
export interface OrphanedObjectDeletion {
	objectId: string
	reason: string
	administratorUserId: string
}
