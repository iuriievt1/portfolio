import type { HeroData, RailData } from '@pkg/design-system'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getDataProvider } from '../data'
import { getGenreItems, getGenreMeta } from '../data/genre'
import type { FeedDescriptor, TitleDetail } from '../data/provider'
import { mergeBrowsePages } from '../features/browse/pagination'
import { toGenreRailData } from '../features/genre/mappers'

type PageData = {
	hero: HeroData | null
	rails: RailData[]
}

async function fetchPage(pageId: string): Promise<PageData> {
	const provider = await getDataProvider()
	const manifest = await provider.getPageFeedManifest(pageId)

	const [hero, ...rails] = await Promise.all([
		manifest.heroFeedId ? provider.getHeroData(manifest.heroFeedId) : Promise.resolve(null),
		...manifest.feeds.map((feed) => provider.getRailData(feed)),
	])

	return {
		hero,
		rails: rails.filter((r): r is RailData => r !== null),
	}
}

export function usePageQuery(pageId: string) {
	return useQuery({
		queryKey: [pageId],
		queryFn: () => fetchPage(pageId),
		staleTime: 0,
		retry: 2,
	})
}

// Keep these as thin wrappers for backward compatibility
export const useHomeQuery = () => usePageQuery('home')
export const useSportsQuery = () => usePageQuery('sports')
export const useKidsQuery = () => usePageQuery('kids')

/** Generic hub page query — works with any hub ID. */
export function useHubPageQuery(hubId: string | undefined) {
	return useQuery({
		queryKey: ['hub-page', hubId],
		queryFn: () => fetchPage(hubId as string),
		enabled: !!hubId,
		staleTime: 0,
		retry: 2,
	})
}

// ── Progressive loading hooks ───────────────────────────────────────

async function fetchManifest(pageId: string) {
	const provider = await getDataProvider()
	return provider.getPageFeedManifest(pageId)
}

export function useManifestQuery(pageId: string) {
	return useQuery({
		queryKey: [pageId, 'manifest'],
		queryFn: () => fetchManifest(pageId),
		staleTime: 0,
		retry: 2,
	})
}

async function fetchHero(heroFeedId: string): Promise<HeroData | null> {
	const provider = await getDataProvider()
	return provider.getHeroData(heroFeedId)
}

export function useHeroQuery(heroFeedId: string | null) {
	return useQuery({
		queryKey: ['hero', heroFeedId],
		queryFn: () => fetchHero(heroFeedId!),
		enabled: !!heroFeedId,
		staleTime: 0,
		retry: 2,
	})
}

async function fetchRail(feed: FeedDescriptor): Promise<RailData | null> {
	const provider = await getDataProvider()
	return provider.getRailData(feed)
}

export function useRailQuery(feed: FeedDescriptor, enabled = true) {
	return useQuery({
		queryKey: ['rail', feed.id],
		queryFn: () => fetchRail(feed),
		enabled,
		staleTime: 0,
		retry: 2,
	})
}

// ── Genre query ─────────────────────────────────────────────────────

async function fetchGenre(genreId: string): Promise<RailData | null> {
	const meta = getGenreMeta(genreId)
	if (!meta) return null

	const items = await getGenreItems(genreId)
	return toGenreRailData(meta.title, meta.variant, items)
}

export function useGenreQuery(genreId: string) {
	return useQuery({
		queryKey: ['genre', genreId],
		queryFn: () => fetchGenre(genreId),
		enabled: !!genreId,
		staleTime: 0,
		retry: 2,
	})
}

// ── Browse (View All grid) ──────────────────────────────────────────

/** Paginated View All feed. Pages are fetched on demand (backend `$skip`/`$top`) and merged into one rail. */
export function useBrowseFeedQuery(feedId: string) {
	const query = useInfiniteQuery({
		queryKey: ['browse', feedId],
		queryFn: async ({ pageParam }) => {
			const provider = await getDataProvider()
			return provider.getBrowseRailPage(feedId, pageParam)
		},
		initialPageParam: 0,
		getNextPageParam: (lastPage) => (lastPage?.hasMore ? lastPage.nextSkip : undefined),
		enabled: !!feedId,
		staleTime: 0,
		retry: 2,
	})

	return {
		rail: mergeBrowsePages(query.data?.pages ?? []),
		isLoading: query.isLoading,
		error: query.error,
		fetchNextPage: query.fetchNextPage,
		hasNextPage: query.hasNextPage,
		isFetchingNextPage: query.isFetchingNextPage,
	}
}

async function fetchTitleDetail(programId: string): Promise<TitleDetail | null> {
	const provider = await getDataProvider()
	return provider.getTitleDetail(programId)
}

/** Retains nothing past unmount: a cached failed resolve would flash its error screen on the next open (#77). */
export function useTitleDetailQuery(programId: string) {
	return useQuery({
		queryKey: ['title-detail', programId],
		queryFn: () => fetchTitleDetail(programId),
		enabled: !!programId,
		staleTime: 0,
		gcTime: 0,
		retry: 2,
	})
}
