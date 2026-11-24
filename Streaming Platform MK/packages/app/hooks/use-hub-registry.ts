import { useQuery } from '@tanstack/react-query'
import { getHubRegistry, type HubRecord } from '../data/hub-registry'

/** Shared base query — single fetch for the full hub registry. */
function useHubRegistryBase() {
	return useQuery({
		queryKey: ['hub-registry'],
		queryFn: getHubRegistry,
		staleTime: 0,
	})
}

/** Returns nav items for the app bar: { label, href }[] */
export function useNavItems() {
	const { data: registry, ...rest } = useHubRegistryBase()
	return {
		...rest,
		data: registry?.map(({ title, href }) => ({ label: title, href })),
	}
}

/** Resolves a URL slug to a hub record. Returns null for unknown slugs. */
export function useHubBySlug(slug: string): { data: HubRecord | null | undefined; isLoading: boolean } {
	const { data: registry, isLoading } = useHubRegistryBase()
	return {
		data: registry ? (registry.find((h) => h.slug === slug) ?? null) : undefined,
		isLoading,
	}
}
