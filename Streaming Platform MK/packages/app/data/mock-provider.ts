import type { HeroData, RailData } from '@pkg/design-system'
import { DEMO_TITLE_HREF, toHeroData, toRailData } from '../features/home/mappers'
import type { MediaItem, Rail } from '../types/media'
import {
	buildActionAdventure,
	buildKidsRails,
	buildLiveNow,
	buildSeriesRail,
	buildSportsRails,
	buildSpotlight,
	buildWeekendPicks,
	ensureMinItems,
	LIVE_NOW,
	MOCK_LIVE_STREAM_URL,
	makeContinueWatching,
} from './home'
import type { BrowseRailPage, DataProvider, FeedDescriptor, NavItem, PageFeedManifest, TitleDetail } from './provider'
import { resolveHeroAsset } from './resolve-hero-asset'

// ── Helpers ──────────────────────────────────────────────────────

function findRail(rails: Rail[], id: string): Rail {
	const rail = rails.find((r) => r.id === id)
	if (!rail) throw new Error(`Mock rail not found: ${id}`)
	return rail
}

/** Clone a rail with a new id and simulate network delay */
async function withDelay(fetcher: () => Promise<Rail>, newId: string, delayMs = 800): Promise<Rail> {
	await new Promise((r) => setTimeout(r, delayMs))
	const rail = await fetcher()
	return { ...rail, id: newId }
}

function toFeedDescriptor(id: string, name: string): FeedDescriptor {
	return { id, name, uri: `mock://${id}` }
}

function getBaseMockId(programId: string): string {
	return decodeURIComponent(programId).split('__')[0] ?? programId
}

function findLiveItem(programId: string): MediaItem | undefined {
	const baseId = getBaseMockId(programId)
	return LIVE_NOW.find((item) => item.id === baseId)
}

function toLiveTitleDetail(item: MediaItem): TitleDetail {
	const imageUrl = item.backdrop?.src ?? item.poster?.src

	return {
		id: item.id,
		name: item.title,
		showType: 'Live',
		assetType: 'vod' as TitleDetail['assetType'],
		synopsis: item.synopsis,
		isAdult: false,
		imageUrl,
		images: imageUrl ? [{ Size: '16x9', ImageType: 'Poster', Uri: imageUrl }] : [],
		playbackUrl: item.playback?.streamUrl ?? MOCK_LIVE_STREAM_URL,
		playActions: [],
	}
}

function getHomeLiveHero(): MediaItem {
	const item = LIVE_NOW[1] ?? LIVE_NOW[0]
	if (!item) throw new Error('Mock live hero not configured')
	return item
}

const HOME_LIVE_HERO = getHomeLiveHero()

// ── Page manifests ───────────────────────────────────────────────

type PageManifestEntry = {
	heroFeedId: string | null
	rails: { id: string; name: string }[]
}

const PAGE_MANIFESTS: Record<string, PageManifestEntry> = {
	home: {
		heroFeedId: 'home-hero',
		rails: [
			{ id: 'rail_spotlight', name: 'Spotlight' },
			{ id: 'rail_continue', name: 'Continue watching' },
			{ id: 'rail_action', name: 'Action & Adventure' },
			{ id: 'rail_weekend', name: 'Weekend picks' },
			{ id: 'rail_live', name: 'Live now' },
		],
	},
	sports: {
		heroFeedId: 'sports-hero',
		rails: [
			{ id: 'rail_sport_multiview', name: 'Multi View' },
			{ id: 'rail_sport_schedule', name: 'Baseball Schedule' },
			{ id: 'rail_sport_highlights', name: 'Defensive Highlights' },
			{ id: 'rail_sport_homeruns', name: 'Home Run Highlights' },
			{ id: 'rail_sport_sponsored', name: 'Sponsored Game Highlights' },
			{ id: 'rail_sports_continue', name: 'Continue watching' },
			{ id: 'rail_sports_leagues', name: 'Sports & competition' },
			{ id: 'rail_sports_live', name: 'Live now' },
			{ id: 'rail_sport_schedule_2', name: 'Upcoming Games' },
			{ id: 'rail_sport_highlights_2', name: 'Top Plays This Week' },
			{ id: 'rail_sport_homeruns_2', name: 'Classic Home Runs' },
			{ id: 'rail_sport_multiview_2', name: 'Multi View — Basketball' },
			{ id: 'rail_sport_sponsored_2', name: 'Partner Highlights' },
			{ id: 'rail_sport_schedule_3', name: 'Football Schedule' },
			{ id: 'rail_sport_highlights_3', name: 'Playoff Moments' },
			{ id: 'rail_sport_homeruns_3', name: 'Walk-Off Hits' },
			{ id: 'rail_sport_multiview_3', name: 'Multi View — Soccer' },
			{ id: 'rail_sport_sponsored_3', name: 'Featured Matchups' },
			{ id: 'rail_sport_schedule_4', name: 'Tennis Schedule' },
			{ id: 'rail_sport_highlights_4', name: 'Season Recap' },
		],
	},
	kids: {
		heroFeedId: 'kids-hero',
		rails: [
			{ id: 'rail_kids_spotlight', name: 'Kids spotlight' },
			{ id: 'rail_kids_continue', name: 'Continue watching' },
			{ id: 'rail_kids_cartoons', name: 'Cartoons' },
			{ id: 'rail_kids_family', name: 'Family movies' },
			{ id: 'rail_kids_series', name: 'Kids series' },
			{ id: 'rail_kids_live', name: 'Live now' },
		],
	},
}

// ── Hero fetchers ────────────────────────────────────────────────

const heroFetchers: Record<string, () => Promise<HeroData>> = {
	'home-hero': async () => ({
		items: [
			{
				id: 'home-live-hero',
				title: HOME_LIVE_HERO.title,
				imageUrl: HOME_LIVE_HERO.backdrop?.src ?? resolveHeroAsset('/heroes/nascar-daytona.webp'),
				href: HOME_LIVE_HERO.href ?? `/title?id=${HOME_LIVE_HERO.id}`,
				tagLabel: 'LIVE',
				isLive: true,
				startTime: 'Now',
				synopsis: HOME_LIVE_HERO.synopsis,
				ctas: [{ label: 'Watch from Start', icon: 'restart', action: 'watch-from-start' }],
			},
			{
				id: 'hero-1',
				title: 'The Running Man',
				imageUrl: 'https://image.tmdb.org/t/p/w1280/aHj7d7wSLqrg5cjAcgHhiGr97Ih.jpg',
				logoUrl: resolveHeroAsset('/logos/running-man.png'),
				href: DEMO_TITLE_HREF,
				tagLabel: 'Recently Added',
				year: 2025,
				duration: '2h 13m',
				synopsis:
					'The Running Man is the top-rated show on television, a deadly competition where contestants must survive 30 days while being hunted by professional assassins.',
			},
			{
				id: 'hero-2',
				title: 'Daredevil: Born Again',
				imageUrl: 'https://image.tmdb.org/t/p/w1280/qHCpG49qxs4owLgmhh0T62ErUZv.jpg',
				logoUrl: resolveHeroAsset('/logos/daredevil.png'),
				href: DEMO_TITLE_HREF,
				tagLabel: 'New Episode',
				year: 2025,
				duration: '45m',
				synopsis:
					"Murdock is stripped of his career and his relationships. Brought to the edge of total ruin, Daredevil must endure his darkest hour to decide what kind of hero he's willing to be.",
			},
			{
				id: 'hero-3',
				title: 'Hail Mary',
				imageUrl: 'https://image.tmdb.org/t/p/w1280/o2xLxY1LdwBMsrGD9hjIaOrIQm6.jpg',
				logoUrl: resolveHeroAsset('/logos/hail-mary.png'),
				href: DEMO_TITLE_HREF,
				tagLabel: 'Recently Added',
				year: 2026,
				duration: '2h 22m',
				synopsis:
					"Ryland Grace, a middle school science teacher wakes up on a spaceship, only to discover he's on a desperate, last-chance mission to save Earth.",
			},
		],
	}),
	'sports-hero': async () => ({
		items: [
			{
				id: 'sports-hero-1',
				title: 'MLB World Series',
				imageUrl: resolveHeroAsset('/heroes/texas-rangers-baseball.webp'),
				imagePosition: 'top',
				href: '/title?id=live_sports_1',
				tagLabel: 'Live',
				isLive: true,
				startTime: '16:45',
				synopsis:
					'A heated divisional clash as the home team looks to extend their lead in the seventh. The bullpen has been lights-out through three scoreless innings, keeping the lineup in check. With runners in scoring position and two outs, the next at-bat could decide it all.',
				ctas: [{ label: 'Watch from Start', icon: 'restart', action: 'watch-from-start' }],
			},
			{
				id: 'sports-hero-2',
				title: 'NBA Finals',
				imageUrl: resolveHeroAsset('/heroes/lakers-vs-grizzlies.webp'),
				imagePosition: 'top',
				href: '/title?id=live_sports_1',
				tagLabel: 'Live',
				isLive: true,
				startTime: '20:30',
				synopsis: 'Both teams battle deep into the fourth as the pace quickens and the margin tightens.',
				ctas: [{ label: 'Watch from Start', icon: 'restart', action: 'watch-from-start' }],
			},
			{
				id: 'sports-hero-3',
				title: 'Grand Prix 500',
				imageUrl: resolveHeroAsset('/heroes/nascar-daytona.webp'),
				href: '/title?id=live_sports_1',
				tagLabel: 'Live',
				isLive: true,
				startTime: '16:45',
				synopsis:
					'The field charges at full speed as positions change lap by lap in one of the most unpredictable races of the season.',
				ctas: [{ label: 'Watch from Start', icon: 'restart', action: 'watch-from-start' }],
			},
		],
	}),
	'kids-hero': async () => {
		const { heroItems } = await buildKidsRails()
		return toHeroData(heroItems)
	},
}

// ── Rail fetchers ────────────────────────────────────────────────
// Cache the *promise* (not the resolved value) so concurrent Suspense
// boundaries share a single in-flight fetch instead of duplicating work.

type BulkData = { heroItems: MediaItem[]; rails: Rail[] }

let _sportsPromise: Promise<BulkData> | null = null
function getSportsData(): Promise<BulkData> {
	if (!_sportsPromise) _sportsPromise = buildSportsRails()
	return _sportsPromise
}

let _kidsPromise: Promise<BulkData> | null = null
function getKidsData(): Promise<BulkData> {
	if (!_kidsPromise) _kidsPromise = buildKidsRails()
	return _kidsPromise
}

let _actionPromise: Promise<Rail> | null = null
function getActionRail(): Promise<Rail> {
	if (!_actionPromise) _actionPromise = buildActionAdventure(null)
	return _actionPromise
}

const railFetchers: Record<string, () => Promise<Rail>> = {
	// ── Home rails ──
	rail_spotlight: buildSpotlight,
	rail_action: async () => getActionRail(),
	rail_weekend: buildWeekendPicks,
	rail_series: buildSeriesRail,
	rail_live: buildLiveNow,
	rail_continue: async () => {
		const action = await getActionRail()
		return {
			id: 'rail_continue',
			title: 'Continue watching',
			subtitle: 'Pick up where you left off',
			layout: 'continue-watching' as const,
			ui: { showArrows: true },
			items: ensureMinItems(makeContinueWatching(action.items, 12), 12, 'rail_continue_min'),
		}
	},

	// ── Sports rails ──
	rail_sport_multiview: async () => findRail((await getSportsData()).rails, 'rail_sport_multiview'),
	rail_sport_schedule: async () => findRail((await getSportsData()).rails, 'rail_sport_schedule'),
	rail_sport_highlights: async () => findRail((await getSportsData()).rails, 'rail_sport_highlights'),
	rail_sport_homeruns: async () => findRail((await getSportsData()).rails, 'rail_sport_homeruns'),
	rail_sport_sponsored: async () => findRail((await getSportsData()).rails, 'rail_sport_sponsored'),
	rail_sports_continue: async () => findRail((await getSportsData()).rails, 'rail_sports_continue'),
	rail_sports_leagues: async () => findRail((await getSportsData()).rails, 'rail_sports_leagues'),
	rail_sports_live: async () => findRail((await getSportsData()).rails, 'rail_sports_live'),
	rail_sport_schedule_2: async () =>
		withDelay(async () => findRail((await getSportsData()).rails, 'rail_sport_schedule'), 'rail_sport_schedule_2'),
	rail_sport_highlights_2: async () =>
		withDelay(async () => findRail((await getSportsData()).rails, 'rail_sport_highlights'), 'rail_sport_highlights_2'),
	rail_sport_homeruns_2: async () =>
		withDelay(async () => findRail((await getSportsData()).rails, 'rail_sport_homeruns'), 'rail_sport_homeruns_2'),
	rail_sport_multiview_2: async () =>
		withDelay(async () => findRail((await getSportsData()).rails, 'rail_sport_multiview'), 'rail_sport_multiview_2'),
	rail_sport_sponsored_2: async () =>
		withDelay(async () => findRail((await getSportsData()).rails, 'rail_sport_sponsored'), 'rail_sport_sponsored_2'),
	rail_sport_schedule_3: async () =>
		withDelay(async () => findRail((await getSportsData()).rails, 'rail_sport_schedule'), 'rail_sport_schedule_3'),
	rail_sport_highlights_3: async () =>
		withDelay(async () => findRail((await getSportsData()).rails, 'rail_sport_highlights'), 'rail_sport_highlights_3'),
	rail_sport_homeruns_3: async () =>
		withDelay(async () => findRail((await getSportsData()).rails, 'rail_sport_homeruns'), 'rail_sport_homeruns_3'),
	rail_sport_multiview_3: async () =>
		withDelay(async () => findRail((await getSportsData()).rails, 'rail_sport_multiview'), 'rail_sport_multiview_3'),
	rail_sport_sponsored_3: async () =>
		withDelay(async () => findRail((await getSportsData()).rails, 'rail_sport_sponsored'), 'rail_sport_sponsored_3'),
	rail_sport_schedule_4: async () =>
		withDelay(async () => findRail((await getSportsData()).rails, 'rail_sport_schedule'), 'rail_sport_schedule_4'),
	rail_sport_highlights_4: async () =>
		withDelay(async () => findRail((await getSportsData()).rails, 'rail_sport_highlights'), 'rail_sport_highlights_4'),

	// ── Kids rails ──
	rail_kids_spotlight: async () => findRail((await getKidsData()).rails, 'rail_kids_spotlight'),
	rail_kids_continue: async () => findRail((await getKidsData()).rails, 'rail_kids_continue'),
	rail_kids_cartoons: async () => findRail((await getKidsData()).rails, 'rail_kids_cartoons'),
	rail_kids_family: async () => findRail((await getKidsData()).rails, 'rail_kids_family'),
	rail_kids_series: async () => findRail((await getKidsData()).rails, 'rail_kids_series'),
	rail_kids_live: async () => findRail((await getKidsData()).rails, 'rail_kids_live'),
}

// ── Provider factory ─────────────────────────────────────────────

export function createMockDataProvider(): DataProvider {
	return {
		async getPageFeedManifest(hubIdOrPageId: string): Promise<PageFeedManifest> {
			// Support mock hub IDs (e.g. "mock-home" → "home")
			const pageId = hubIdOrPageId.replace('mock-', '')
			const manifest = PAGE_MANIFESTS[pageId]
			if (!manifest) return { heroFeedId: null, feeds: [] }

			return {
				heroFeedId: manifest.heroFeedId,
				feeds: manifest.rails.map((r) => toFeedDescriptor(r.id, r.name)),
			}
		},

		async getHeroData(feedId: string): Promise<HeroData | null> {
			const fetcher = heroFetchers[feedId]
			if (!fetcher) return null
			return fetcher()
		},

		async getRailData(feed: FeedDescriptor): Promise<RailData | null> {
			const fetcher = railFetchers[feed.id]
			if (!fetcher) return null
			const rail = await fetcher()
			return toRailData(rail)
		},

		async getBrowseRailPage(): Promise<BrowseRailPage | null> {
			// Browse/View-All is an API-mode feature; mock mode renders the empty state.
			return null
		},

		async getNavItems(): Promise<NavItem[]> {
			return [
				{ label: 'Home', hubId: 'mock-home' },
				{ label: 'Sports', hubId: 'mock-sports' },
				{ label: 'Kids', hubId: 'mock-kids' },
			]
		},

		async putBookmark() {
			// Mock mode: bookmarks not persisted.
		},

		async getBookmark() {
			return null
		},

		async getTitleDetail(programId: string): Promise<TitleDetail | null> {
			const liveItem = findLiveItem(programId)
			if (liveItem) return toLiveTitleDetail(liveItem)

			return null
		},

		resetCaches(): void {
			_sportsPromise = null
			_kidsPromise = null
			_actionPromise = null
		},
	}
}
