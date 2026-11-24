import type { MediaItem, Rail } from '../types/media'
import { discoverMovies, getTrendingMovies, searchMovies, searchTv, trendingTvWeek } from './tmdb'

const minutes = (m: number) => m * 60

const BLOCKED_IMAGES = ['hU2jZSnNrLOnIRZw5D1xIH56Jc7']

const isBlocked = (src?: string) => src && BLOCKED_IMAGES.some((b) => src.includes(b))

const withAnyImage = (x: MediaItem) =>
	!!(x.poster?.src || x.backdrop?.src) && !isBlocked(x.poster?.src) && !isBlocked(x.backdrop?.src)

export const withInstanceId = (it: MediaItem, instanceId: string): MediaItem => ({
	...it,
	id: `${it.id}__${instanceId}`,
})

export function generateEpisodeItems(series: MediaItem, count = 12): MediaItem[] {
	const baseId = series.id.split('__')[0]

	return Array.from({ length: count }).map((_, i) => {
		const season = 1 + Math.floor(i / 6)
		const ep = 1 + (i % 6)

		const thumb: MediaItem['backdrop'] = {
			src: `https://picsum.photos/seed/${baseId}-s${season}e${ep}/1280/720`,
			alt: `${series.title} S${season}E${ep}`,
		}

		return {
			id: `${baseId}_s${season}e${ep}`,
			kind: 'series',
			title: `S${season}E${ep}: Episode ${ep}`,
			originalTitle: series.title,
			year: series.year,
			synopsis: `New episode of ${series.title}`,
			genres: series.genres,
			backdrop: thumb,
			poster: series.poster,
			badges: [{ type: 'tag', label: 'New Episode' }],
			playback: { playable: true, protocol: 'hls', streamUrl: 'https://example.invalid/ep.m3u8' },
			meta: { likes: 0, views: 0 },
		}
	})
}

export const ensureMinItems = (items: MediaItem[], min: number, instancePrefix: string): MediaItem[] => {
	const base = items.filter(withAnyImage)
	if (base.length >= min) return base

	if (base.length === 0) return []

	const out: MediaItem[] = []
	let i = 0

	while (out.length < min) {
		const it = base[i % base.length]
		out.push(withInstanceId(it, `${instancePrefix}_${out.length}`))
		i++
	}

	return out
}

export function buildHeroItems(source: MediaItem[], count = 5): MediaItem[] {
	const candidates = source.filter((x) => x.backdrop)

	return ensureMinItems(candidates.slice(0, count), count, 'hero')
}
const randomPoster = (seed: string) => ({
	src: `https://picsum.photos/seed/${seed}/600/900`,
})

const randomBackdrop = (seed: string) => ({
	src: `https://picsum.photos/seed/${seed}-bg/1280/720`,
})

const repeatItems = (items: MediaItem[], times: number, instancePrefix: string): MediaItem[] =>
	Array.from({ length: times }).flatMap((_, rep) =>
		items.map((it, idx) => ({
			...it,
			id: `${it.id}__${instancePrefix}_${rep}_${idx}`,
		})),
	)

// -------------------- LIVE NOW (local, TMDB doesn't have this)
export const MOCK_LIVE_STREAM_URL = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'

export const LIVE_NOW: MediaItem[] = [
	{
		id: 'live_natgeo_1',
		kind: 'live',
		title: 'Running Wild With Bear Grylls',
		href: '/title?id=live_natgeo_1',
		poster: randomPoster('live_natgeo_1'),
		backdrop: randomBackdrop('live_natgeo_1'),
		badges: [{ type: 'live', label: 'LIVE' }],
		synopsis: 'Live survival stories and remote expeditions from around the world.',
		live: {
			channel: 'National Geographic Wild',
			episode: 'S1 E3',
			ctaLabel: 'Watch Live',
			progress: 0.45,
		},
		playback: {
			playable: true,
			protocol: 'hls',
			streamUrl: MOCK_LIVE_STREAM_URL,
		},
	},
	{
		id: 'live_sports_1',
		kind: 'live',
		title: 'City Derby — Live',
		href: '/title?id=live_sports_1',
		poster: randomPoster('live_sports_1'),
		backdrop: randomBackdrop('live_sports_1'),
		badges: [{ type: 'live', label: 'LIVE' }],
		synopsis: 'Live coverage from the stadium with pre-match build-up and in-game action.',
		live: {
			channel: 'Sports One',
			episode: 'Kick-off',
			ctaLabel: 'Watch Live',
			progress: 0.18,
		},
		playback: {
			playable: true,
			protocol: 'hls',
			streamUrl: MOCK_LIVE_STREAM_URL,
		},
	},
	{
		id: 'live_news_1',
		kind: 'live',
		title: 'Breaking: Market Watch',
		href: '/title?id=live_news_1',
		poster: randomPoster('live_news_1'),
		backdrop: randomBackdrop('live_news_1'),
		badges: [{ type: 'live', label: 'LIVE' }],
		synopsis: 'Live market updates, analysis, and breaking business news as it happens.',
		live: {
			channel: 'MK News',
			episode: 'Live',
			ctaLabel: 'Watch Live',
			progress: 0.62,
		},
		playback: {
			playable: true,
			protocol: 'hls',
			streamUrl: MOCK_LIVE_STREAM_URL,
		},
	},
]

// -------------------- Continue watching (creates fake progress from real items)
export function makeContinueWatching(seed: MediaItem[], min: number): MediaItem[] {
	const base = seed.filter((x) => x.kind === 'movie' || x.kind === 'series').slice(0, 6)
	const ensured = ensureMinItems(base, min, 'cw_seed')

	const now = Date.now()

	return ensured.map((it, idx) => {
		const duration = it.durationSec ?? minutes(52)
		const ratio = 0.12 + (idx % 8) * 0.08
		const position = Math.min(duration * 0.85, Math.max(duration * 0.05, Math.floor(duration * ratio)))

		return {
			...withInstanceId(it, `cw_${idx}`),
			episodeLabel: `Ep ${(idx % 8) + 1} · ${it.title}`,
			progress: {
				positionSec: position,
				durationSec: duration,
				updatedAtIso: new Date(now - 1000 * 60 * (20 + idx * 35)).toISOString(),
			},
			badges: it.badges,
		}
	})
}

// -------------------- RAILS builders
export async function buildSpotlight(): Promise<Rail> {
	const items = await getTrendingMovies()
	return {
		id: 'rail_spotlight',
		title: 'Spotlight',
		subtitle: "Editor's picks • Updated daily",
		layout: 'backdrop-strip',
		ui: { showArrows: true, showSeeAll: true, seeAllHref: '/home/genre/spotlight', seeAllLabel: 'View all' },
		items: ensureMinItems(repeatItems(items.slice(0, 20), 2, 'rail_spotlight').slice(0, 20), 12, 'rail_spotlight_min'),
	}
}

export async function buildActionAdventure(hero: MediaItem | null): Promise<Rail> {
	// 28 = Action, 12 = Adventure (TMDB genre ids)
	const items = await discoverMovies({
		with_genres: '28,12',
		sort_by: 'popularity.desc',
		page: 1,
	})

	const head: MediaItem[] = hero ? [withInstanceId(hero, 'rail_action_hero')] : []

	return {
		id: 'rail_action',
		title: 'Action & Adventure',
		subtitle: 'Explosions guaranteed',
		layout: 'poster-strip',
		ui: { showArrows: true, showSeeAll: true, seeAllHref: '/home/genre/action' },
		items: ensureMinItems([...head, ...items.slice(0, 20)], 12, 'rail_action_min'),
	}
}

export async function buildWeekendPicks(): Promise<Rail> {
	const items = await discoverMovies({
		sort_by: 'vote_average.desc',
		'vote_count.gte': 3000,
		page: 1,
	})

	return {
		id: 'rail_weekend',
		title: 'Weekend picks',
		subtitle: 'Light & easy watching',
		layout: 'featured-mini',
		ui: { showArrows: true },
		items: ensureMinItems(items.slice(0, 20), 12, 'rail_weekend_min'),
	}
}

export async function buildLiveNow(): Promise<Rail> {
	return {
		id: 'rail_live',
		title: 'Live now',
		subtitle: 'Events happening right now',
		layout: 'live-strip',
		ui: { showArrows: true, showSeeAll: true, seeAllHref: '/sports', seeAllLabel: 'View all' },
		items: ensureMinItems(
			LIVE_NOW.map((it, idx) => withInstanceId(it, `rail_live_${idx}`)),
			12,
			'rail_live_min',
		),
	}
}

export async function buildSeriesRail(): Promise<Rail> {
	const items = await trendingTvWeek()

	return {
		id: 'rail_series',
		title: 'Series',
		subtitle: 'Binge-worthy right now',
		layout: 'poster-strip',
		ui: { showArrows: true, showSeeAll: true, seeAllHref: '/home/genre/series', seeAllLabel: 'View all' },
		items: ensureMinItems(items.slice(0, 20), 12, 'rail_series_min'),
	}
}

// ── Sports-specific mock item builders ──

function buildScheduleItems(): MediaItem[] {
	const matchups = [
		{ home: 'Spring Training Classic', away: '', date: 'MAR 2, 2:00pm', seed: 'sched3' },
		{ home: 'Cactus League Opener', away: '', date: 'MAR 11, 3:30pm', seed: 'sched4' },
		{ home: 'MLB Opening Day', away: '', date: 'APR 14, 3:30pm', seed: 'sched1' },
		{ home: 'Interleague Series', away: '', date: 'APR 23, 3:20pm', seed: 'sched2' },
		{ home: 'Rivalry Weekend', away: '', date: 'APR 28, 7:05pm', seed: 'sched5' },
		{ home: 'Saturday Showdown', away: '', date: 'MAY 3, 4:10pm', seed: 'sched6' },
		{ home: 'Sunday Night Baseball', away: '', date: 'MAY 7, 1:05pm', seed: 'sched7' },
		{ home: 'Midweek Classic', away: '', date: 'MAY 12, 7:10pm', seed: 'sched8' },
		{ home: 'Memorial Day Series', away: '', date: 'MAY 17, 4:05pm', seed: 'sched9' },
		{ home: 'Pennant Race Preview', away: '', date: 'MAY 22, 6:35pm', seed: 'sched10' },
		{ home: 'Division Rivals', away: '', date: 'MAY 28, 3:10pm', seed: 'sched11' },
		{ home: 'Summer Series Opener', away: '', date: 'JUN 2, 7:05pm', seed: 'sched12' },
	]
	return matchups.map((m) => ({
		id: `schedule_${m.seed}`,
		kind: 'sport' as const,
		title: m.away ? `${m.home} vs. ${m.away}` : m.home,
		backdrop: randomBackdrop(m.seed),
		sport: { variant: 'sport_upcoming' as const, timeLabel: m.date, league: 'MLB', category: 'Baseball' },
		playback: { playable: true, protocol: 'hls' as const, streamUrl: 'https://example.invalid/sport.m3u8' },
		// TODO: hotfix — href omitted, DEMO_TITLE_HREF fallback in mappers.ts applies.
		// Restore: href: `/title/${realProgramId}` when DATA_SOURCE=api.
	}))
}

function buildHighlightsItems(): MediaItem[] {
	const clips = [
		{
			title: 'Incredible throw to home plate',
			meta: 'Aug 9th · Highlights · MLB Regular Season',
			seed: 'hl1',
		},
		{
			title: 'Impressive outfield assist',
			meta: 'Aug 9th · Highlights · MLB Regular Season',
			seed: 'hl2',
		},
		{ title: 'Slick catch at first base', meta: 'Aug 28th · Highlights · American League Series', seed: 'hl3' },
		{
			title: 'Sweet leaping catch at the wall',
			meta: 'Aug 29th · Highlights · Interleague Play',
			seed: 'hl4',
		},
		{ title: 'Diving tag saves the run', meta: 'Aug 29th · Highlights · Interleague Play', seed: 'hl5' },
		{
			title: 'Go-ahead three-run homer',
			meta: 'Sep 28th · Highlights · Pennant Race',
			seed: 'hl6',
		},
		{ title: 'Solo home run to deep left', meta: 'Sep 21st · Highlights · Division Series', seed: 'hl7' },
		{
			title: 'Game tying home run in the ninth',
			meta: 'Sep 19th · Highlights · Division Series',
			seed: 'hl8',
		},
		{ title: 'Double play turns the tide', meta: 'Sep 25th · Highlights · National League Playoffs', seed: 'hl9' },
		{ title: 'Walk-off single in extras', meta: 'Sep 27th · Highlights · Championship Series', seed: 'hl10' },
		{ title: 'Relay throw nails the runner', meta: 'Oct 1st · Highlights · ALCS Game 3', seed: 'hl11' },
		{ title: 'Bases-loaded grand slam', meta: 'Oct 3rd · Highlights · NLCS Game 5', seed: 'hl12' },
		{ title: 'Robbed home run at the wall', meta: 'Oct 5th · Highlights · World Series Game 1', seed: 'hl13' },
		{ title: 'Perfect bunt to advance the runner', meta: 'Oct 8th · Highlights · World Series Game 4', seed: 'hl14' },
	]
	return clips.map((c) => ({
		id: `highlight_${c.seed}`,
		kind: 'sport' as const,
		title: c.title,
		backdrop: randomBackdrop(c.seed),
		sport: {
			variant: 'sport_highlight' as const,
			label: 'Highlights',
			timeLabel: c.meta.split(' · ')[0],
			league: c.meta.split(' · ').pop(),
		},
		playback: { playable: true, protocol: 'hls' as const, streamUrl: 'https://example.invalid/sport.m3u8' },
		// TODO: hotfix — href omitted, DEMO_TITLE_HREF fallback in mappers.ts applies.
		// Restore: href: `/title/${realProgramId}` when DATA_SOURCE=api.
		// Pre-computed metaLine for the mapper
		synopsis: c.meta,
	}))
}

function buildMultiviewItems(): MediaItem[] {
	const items = [
		{ title: 'MLB Doubleheader\nAmerican League', count: 2, type: 'Multiple Games', league: 'MLB', seed: 'mv1' },
		{ title: 'Grand Prix 500', count: 3, type: 'Multi Cam', league: 'Racing', seed: 'mv2' },
		{
			title: 'NBA Conference Finals\nEastern · Western',
			count: 4,
			type: 'Multiple Games',
			league: 'NBA',
			seed: 'mv3',
		},
		{ title: 'Formula Series Qualifier', count: 3, type: 'Multi Cam', league: 'Racing', seed: 'mv4' },
	]
	return items.map((m) => ({
		id: `multiview_${m.seed}`,
		kind: 'sport' as const,
		title: m.title,
		href: `/multiview?id=multiview_${m.seed}`,
		backdrop: randomBackdrop(m.seed),
		sport: {
			variant: 'sport_multicam' as const,
			multiCamCount: m.count,
			label: m.type,
			league: m.league,
		},
		playback: { playable: true, protocol: 'hls' as const, streamUrl: 'https://example.invalid/sport.m3u8' },
	}))
}

function buildSponsoredItems(): MediaItem[] {
	const items = [
		{ title: 'MLB All-Star Game', meta: 'Aug 10th · Highlights', seed: 'sp1' },
		{ title: 'Home Run Derby', meta: 'Aug 10th · Highlights', seed: 'sp2' },
		{ title: 'Sunday Night Baseball', meta: 'Aug 10th · Highlights', seed: 'sp3' },
		{ title: 'Rivalry Weekend Recap', meta: 'Aug 10th · Highlights', seed: 'sp4' },
		{ title: 'Pennant Race Showdown', meta: 'Aug 11th · Highlights', seed: 'sp5' },
		{ title: 'Wild Card Round', meta: 'Aug 12th · Highlights', seed: 'sp6' },
		{ title: 'Division Series Game 1', meta: 'Aug 13th · Highlights', seed: 'sp7' },
		{ title: 'Championship Series', meta: 'Aug 14th · Highlights', seed: 'sp8' },
		{ title: 'World Series Preview', meta: 'Aug 15th · Highlights', seed: 'sp9' },
		{ title: 'Postseason Recap', meta: 'Aug 16th · Highlights', seed: 'sp10' },
	]
	return items.map((s) => ({
		id: `sponsored_${s.seed}`,
		kind: 'sport' as const,
		title: s.title,
		backdrop: randomBackdrop(s.seed),
		sport: { variant: 'sport_highlight' as const, label: s.meta.split(' · ')[1], timeLabel: s.meta.split(' · ')[0] },
		playback: { playable: true, protocol: 'hls' as const, streamUrl: 'https://example.invalid/sport.m3u8' },
		// TODO: hotfix — href omitted, DEMO_TITLE_HREF fallback in mappers.ts applies.
		// Restore: href: `/title/${realProgramId}` when DATA_SOURCE=api.
	}))
}

export async function buildSportsRails(): Promise<{ heroItems: MediaItem[]; rails: Rail[] }> {
	const [spotlightMovies, spotlightTv, football, basketball, racing] = await Promise.all([
		searchMovies('sport', 1),
		searchTv('sport', 1),
		searchMovies('football', 1),
		searchMovies('basketball', 1),
		searchMovies('racing', 1),
	])

	const spotlightItems = [...spotlightMovies, ...spotlightTv].filter(withAnyImage)
	const heroItems = buildHeroItems(spotlightItems, 3)

	// ── New sport-specific rails ──

	const multiviewRail: Rail = {
		id: 'rail_sport_multiview',
		title: 'Multi View',
		layout: 'multiview-strip',
		ui: { showArrows: true },
		items: buildMultiviewItems(),
	}

	const scheduleRail: Rail = {
		id: 'rail_sport_schedule',
		title: 'Baseball Schedule',
		layout: 'schedule-strip',
		ui: { showArrows: true, showSeeAll: true, seeAllHref: '/sports/schedule' },
		items: buildScheduleItems(),
	}

	const highlightsRail: Rail = {
		id: 'rail_sport_highlights',
		title: 'Defensive Highlights',
		layout: 'highlights-strip',
		ui: { showArrows: true, showSeeAll: true, seeAllHref: '/sports/highlights/defensive' },
		items: buildHighlightsItems().slice(0, 8),
	}

	const homeRunRail: Rail = {
		id: 'rail_sport_homeruns',
		title: 'Home Run Highlights',
		layout: 'highlights-strip',
		ui: { showArrows: true, showSeeAll: true, seeAllHref: '/sports/highlights/homeruns' },
		items: buildHighlightsItems().slice(6),
	}

	const sponsoredRail: Rail = {
		id: 'rail_sport_sponsored',
		title: 'Sponsored Game Highlights',
		layout: 'sponsored-strip',
		ui: { showArrows: true },
		items: buildSponsoredItems(),
	}

	// ── Existing sport rails (kept) ──

	const leagueItems = [...football, ...basketball, ...racing].filter(withAnyImage)

	const leagues: Rail = {
		id: 'rail_sports_leagues',
		title: 'Sports & competition',
		subtitle: 'Football • Basketball • Racing',
		layout: 'poster-strip',
		ui: { showArrows: true, showSeeAll: true, seeAllHref: '/sports/genre/sports-leagues' },
		items: ensureMinItems(leagueItems.slice(0, 24), 12, 'sports_leagues_min'),
	}

	const live: Rail = {
		id: 'rail_sports_live',
		title: 'Live now',
		subtitle: 'Events happening right now',
		layout: 'live-strip',
		ui: { showArrows: true, showSeeAll: true, seeAllHref: '/sports', seeAllLabel: 'View all' },
		items: ensureMinItems(
			LIVE_NOW.map((it, idx) => withInstanceId(it, `sports_live_${idx}`)),
			12,
			'sports_live_min',
		),
	}

	const continueWatching: Rail = {
		id: 'rail_sports_continue',
		title: 'Continue watching',
		subtitle: 'Pick up where you left off',
		layout: 'continue-watching',
		ui: { showArrows: true },
		items: ensureMinItems(makeContinueWatching(leagues.items, 12), 12, 'sports_continue_min'),
	}

	return {
		heroItems,
		rails: [multiviewRail, scheduleRail, highlightsRail, homeRunRail, sponsoredRail, continueWatching, leagues, live],
	}
}

// ---------- KIDS ----------
export async function buildKidsRails(): Promise<{ heroItems: MediaItem[]; rails: Rail[] }> {
	// Kids = Family (10751) + Animation (16)
	const [familyAnim, family, anim, kidsTv] = await Promise.all([
		discoverMovies({ with_genres: '10751,16', sort_by: 'popularity.desc', page: 1, include_adult: 'false' }),
		discoverMovies({ with_genres: '10751', sort_by: 'popularity.desc', page: 1, include_adult: 'false' }),
		discoverMovies({ with_genres: '16', sort_by: 'popularity.desc', page: 1, include_adult: 'false' }),
		searchTv('kids', 1),
	])

	const spotlightItems = [...familyAnim, ...kidsTv].filter((x) => x.poster || x.backdrop)
	const heroItems = buildHeroItems(spotlightItems, 3)

	const spotlight: Rail = {
		id: 'rail_kids_spotlight',
		title: 'Kids spotlight',
		subtitle: 'Fun for the whole family',
		layout: 'backdrop-strip',
		ui: { showArrows: true },
		items: ensureMinItems(
			repeatItems(spotlightItems.slice(0, 20), 2, 'kids_spotlight').slice(0, 20),
			12,
			'kids_spotlight_min',
		),
	}

	const cartoons: Rail = {
		id: 'rail_kids_cartoons',
		title: 'Cartoons',
		subtitle: 'Animation hits',
		layout: 'poster-strip',
		ui: { showArrows: true, showSeeAll: true, seeAllHref: '/kids/genre/cartoons' },
		items: ensureMinItems(anim.slice(0, 24), 12, 'kids_cartoons_min'),
	}

	const familyRail: Rail = {
		id: 'rail_kids_family',
		title: 'Family movies',
		subtitle: 'Everyone can watch',
		layout: 'featured-mini',
		ui: { showArrows: true },
		items: ensureMinItems(family.slice(0, 24), 12, 'kids_family_min'),
	}

	const seriesRail: Rail = {
		id: 'rail_kids_series',
		title: 'Kids series',
		subtitle: 'Short episodes, big smiles',
		layout: 'poster-strip',
		ui: { showArrows: true },
		items: ensureMinItems(kidsTv.slice(0, 24), 12, 'kids_series_min'),
	}

	const continueWatching: Rail = {
		id: 'rail_kids_continue',
		title: 'Continue watching',
		subtitle: 'Pick up where you left off',
		layout: 'continue-watching',
		ui: { showArrows: true },
		items: ensureMinItems(makeContinueWatching(cartoons.items, 12), 12, 'kids_continue_min'),
	}

	const liveKids: Rail = {
		id: 'rail_kids_live',
		title: 'Live now',
		subtitle: 'Cartoons on right now',
		layout: 'live-strip',
		ui: { showArrows: true, showSeeAll: true, seeAllHref: '/kids', seeAllLabel: 'View all' },
		items: ensureMinItems(
			LIVE_NOW.map((it, idx) => ({
				...withInstanceId(it, `kids_live_${idx}`),
				title: idx % 2 === 0 ? 'Cartoon Hour — Live' : it.title,
			})),
			12,
			'kids_live_min',
		),
	}

	return { heroItems, rails: [spotlight, continueWatching, cartoons, familyRail, seriesRail, liveKids] }
}
