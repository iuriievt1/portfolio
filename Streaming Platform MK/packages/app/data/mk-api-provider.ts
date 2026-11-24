import type { HeroData, RailData } from '@pkg/design-system'
import { resolveHomeHubId } from './home-hub'
import { boot } from './mk-api/boot'
import { createMkApiProvider } from './mk-api/provider'
import type { FeedDescriptor, PageFeedManifest, TitleDetail } from './mk-api/types'
import type { DataProvider, NavItem } from './provider'

type MkApiState = {
	provider: ReturnType<typeof createMkApiProvider>
	homeHubId: string
	expiresAt: number
}

let _state: MkApiState | null = null

async function getState(): Promise<MkApiState> {
	if (_state && Date.now() < _state.expiresAt) return _state

	const { config, accessToken, expiresAt, userAccessToken, userProfileId } = await boot()
	const provider = createMkApiProvider(config, accessToken, userAccessToken, userProfileId)

	_state = {
		provider,
		homeHubId: config.navHubIds.home,
		expiresAt,
	}

	return _state
}

export async function createMkApiDataProvider(): Promise<DataProvider> {
	await getState()

	return {
		async getPageFeedManifest(hubIdOrPageId: string): Promise<PageFeedManifest> {
			const { provider, homeHubId } = await getState()

			// Home hub: the configured id, but only if the active store has it.
			if (hubIdOrPageId === 'home') return provider.getHomePageFeeds(homeHubId)

			// Legacy sports/kids → auto-discover by keyword
			if (hubIdOrPageId === 'sports' || hubIdOrPageId === 'kids') {
				return provider.autoDiscoverPageFeeds(hubIdOrPageId)
			}

			// Direct hub ID — passthrough
			return provider.getPageFeeds(hubIdOrPageId)
		},

		async getHeroData(feedId: string): Promise<HeroData | null> {
			const { provider } = await getState()
			return provider.getHeroData(feedId)
		},

		async getRailData(feed: FeedDescriptor): Promise<RailData | null> {
			const { provider } = await getState()

			return provider.getRailData(feed)
		},

		async getBrowseRailPage(feedId: string, skip: number) {
			const { provider } = await getState()
			return provider.getBrowseRailPage(feedId, skip)
		},

		async getTitleDetail(programId: string): Promise<TitleDetail | null> {
			const { provider } = await getState()
			return provider.getTitleDetail(programId)
		},

		async getNavItems(): Promise<NavItem[]> {
			const { provider, homeHubId } = await getState()
			const hubs = await provider.fetchHubs()

			// Return raw hub identity — registry handles slugs/hrefs
			const items: NavItem[] = hubs.map((hub) => ({
				label: hub.Name,
				hubId: hub.Id,
			}))

			// Home hub first. Ignores a configured id the active store does not have,
			// otherwise a store switch leaves the wrong hub leading the nav.
			const effectiveHomeHubId = resolveHomeHubId(
				homeHubId,
				hubs.map((hub) => hub.Id),
			)
			items.sort((a, b) => {
				if (a.hubId === effectiveHomeHubId) return -1
				if (b.hubId === effectiveHomeHubId) return 1
				return 0
			})

			return items
		},

		async putBookmark(input) {
			const { provider } = await getState()
			return provider.putBookmark(input)
		},

		async getBookmark(videoId) {
			const { provider } = await getState()
			return provider.getBookmark(videoId)
		},

		resetCaches() {
			_state = null
		},
	}
}
