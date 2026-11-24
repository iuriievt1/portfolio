export const REGISTRY_SOURCE_FACTORY = Symbol("REGISTRY_SOURCE_FACTORY")
export const REGISTRY_SYNC_LOCK_NAME = "registry_sync"
export const SETTINGS_POLL_MILLISECONDS = 60_000

export const UPSERT_OUTCOME = {
	ADDED: "added",
	CHANGED: "changed",
	UNCHANGED: "unchanged",
} as const

export type UpsertOutcome = (typeof UPSERT_OUTCOME)[keyof typeof UPSERT_OUTCOME]
