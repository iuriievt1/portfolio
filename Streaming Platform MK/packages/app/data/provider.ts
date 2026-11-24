import type { HeroData, RailData } from '@pkg/design-system'
import { getClientEnv } from '@pkg/utils/client-env'
import type { BrowseRailPage, FeedDescriptor, PageFeedManifest, TitleDetail } from './mk-api/types'
import { applyRailDisplayLimit } from './rail-display'

export type { BrowseRailPage, FeedDescriptor, PageFeedManifest, TitleDetail }

/** Raw hub identity — provider returns these without route knowledge. Hub registry owns slugs/hrefs. */
export type NavItem = { label: string; hubId: string }

/** Source-agnostic data provider. Both mock and real API implement this. */
export interface DataProvider {
	/** Accepts a hub ID or a legacy pageId (home/sports/kids). */
	getPageFeedManifest(hubIdOrPageId: string): Promise<PageFeedManifest>
	getHeroData(feedId: string): Promise<HeroData | null>
	getRailData(feed: FeedDescriptor): Promise<RailData | null>
	/** Fetches one page of a feed for the View All grid (backend `$skip`/`$top` paging). Null when not found or unsupported. */
	getBrowseRailPage(feedId: string, skip: number): Promise<BrowseRailPage | null>
	getTitleDetail(programId: string): Promise<TitleDetail | null>
	getNavItems(): Promise<NavItem[]>
	/** Writes a subscriber bookmark for VOD progress tracking. No-op when user not authenticated. */
	putBookmark(input: {
		videoId: string
		programId?: string | null
		timeSeconds: number
		runtimeSeconds: number
	}): Promise<void>
	/** GET the current bookmark for a videoId. Returns null if no bookmark or auth missing. */
	getBookmark(videoId: string): Promise<{ TimeSeconds: number } | null>
	resetCaches(): void
}

let _providerPromise: Promise<DataProvider> | null = null

/** Returns the data provider for the current DATA_SOURCE env. Cached per process/session. */
export function getDataProvider(): Promise<DataProvider> {
	if (!_providerPromise) {
		_providerPromise = initProvider().catch((err) => {
			_providerPromise = null
			throw err
		})
	}
	return _providerPromise
}

async function initProvider(): Promise<DataProvider> {
	const { dataSource } = getClientEnv()

	if (dataSource === 'api') {
		const { createMkApiDataProvider } = await import('./mk-api-provider')
		const provider = await createMkApiDataProvider()
		return withRailDisplayLimit(provider)
	}

	const { createMockDataProvider } = await import('./mock-provider')
	const provider = await createMockDataProvider()
	return withRailDisplayLimit(provider)
}

/** Applies the rail display cap to every source, so no consumer can bypass it. */
function withRailDisplayLimit(provider: DataProvider): DataProvider {
	return {
		...provider,
		getRailData: async (feed) => {
			const rail = await provider.getRailData(feed)
			return rail && applyRailDisplayLimit(rail)
		},
	}
}
