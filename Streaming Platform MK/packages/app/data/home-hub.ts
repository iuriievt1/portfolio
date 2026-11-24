/**
 * Picks the home hub for the store that is currently active. The configured id
 * (`NEXT_PUBLIC_MK_HOME_HUB_ID`) is store-scoped, so it only counts when the active
 * store actually returns it — after a store switch it belongs to the previous store
 * and using it verbatim renders an empty home page.
 *
 * Kept dependency-free so both the MK provider and the hub registry can use it
 * without an import cycle.
 */
export function resolveHomeHubId(configuredId: string | undefined, hubIds: string[]): string | null {
	const configured = configuredId?.trim()
	if (configured && hubIds.includes(configured)) return configured
	return hubIds[0] ?? null
}
