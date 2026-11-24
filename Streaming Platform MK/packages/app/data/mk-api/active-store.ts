/**
 * Holds the store id currently selected in the store switcher. `boot()` reads it
 * instead of NEXT_PUBLIC_MK_STORE_ID, so switching a store plus `resetCaches()`
 * re-resolves every hub, feed and bookmark against the new store.
 */

let _activeStoreId: string | null = null

/** Overrides the env store. Pass `null` to fall back to `NEXT_PUBLIC_MK_STORE_ID`. */
export function setActiveStoreId(storeId: string | null): void {
	_activeStoreId = storeId?.trim() || null
}

export function getActiveStoreId(): string | null {
	return _activeStoreId
}
