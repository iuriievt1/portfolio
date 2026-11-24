import { resolveHomeHubId } from './home-hub'
import { getDataProvider } from './provider'
import { slugifyHub } from './slugify'

export { resolveHomeHubId }

export type HubRecord = {
	id: string
	title: string
	slug: string
	href: string
	isHome: boolean
}

function uniquifySlug(base: string, seen: Map<string, number>): string {
	const count = seen.get(base) ?? 0
	seen.set(base, count + 1)
	return count === 0 ? base : `${base}-${count + 1}`
}

export function isHomeHub(hubId: string, homeHubId: string | undefined): boolean {
	return !!homeHubId && hubId === homeHubId
}

/**
 * Fetches all hubs from the provider and builds a normalized registry.
 * Home hub is the first item returned by getNavItems(); provider is responsible for sorting home first.
 * All others get href="/hub/{slug}".
 *
 * No manual TTL cache — callers use React Query for staleness.
 */
export async function getHubRegistry(): Promise<HubRecord[]> {
	const provider = await getDataProvider()
	const navItems = await provider.getNavItems()

	if (navItems.length === 0) return []

	// First item is home (provider sorts home first)
	const homeHubId = navItems[0].hubId
	const seen = new Map<string, number>()

	return navItems.map((item) => {
		const slug = uniquifySlug(slugifyHub(item.label), seen)
		const home = isHomeHub(item.hubId, homeHubId)
		return {
			id: item.hubId,
			title: item.label,
			slug,
			href: home ? '/' : `/hub?slug=${slug}`,
			isHome: home,
		}
	})
}

export async function getHomeHub(): Promise<HubRecord | null> {
	const registry = await getHubRegistry()
	return registry.find((h) => h.isHome) ?? registry[0] ?? null
}

export async function getHubBySlug(slug: string): Promise<HubRecord | null> {
	const registry = await getHubRegistry()
	return registry.find((h) => h.slug === slug) ?? null
}
