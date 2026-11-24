import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeedDescriptor } from '../../provider'
import { createMkApiProvider } from '../provider'
import type { AppConfig } from '../types'

const config: AppConfig = {
	mkApiHost: 'https://api.example.com',
	tenantId: 'tenant1',
	storeId: 'HubsAndFeeds-!tenant1!Main',
	imageBaseUrl: 'https://img.example.com',
	groups: 'g1',
	profileId: 'p1',
	locationDetail: 'loc',
	discoveryUrl: 'https://api.example.com/discovery',
	subscriberServiceUrl: 'https://api.example.com/subscriber',
	catalogCacheUrl: 'https://api.example.com/catalogcache',
	searchServiceUrl: 'https://api.example.com/search',
	stsServiceUrl: 'https://api.example.com/sts',
	playerServerUrl: 'https://player.example.com',
	channelMapId: 10507,
	navHubIds: { home: '' },
	feedDisplayTypes: { jumboFeedIds: [], characterFeedIds: [] },
	continueWatchingUdl: '',
	favouritesUdl: '',
} as unknown as AppConfig

/** A custom "On Now" feed: live channels identified by station id, no playable asset id. */
const CHANNEL_FEED = {
	Uri: null,
	Items: [
		{ Id: '11345', Name: 'KTVU-HD-2 (FOX)', ItemType: 'Channel' },
		{ Id: '14098', Name: 'KTVU-2 (FOX)', ItemType: 'Channel', SupportedImages: ['4x3/Logo', '4x3/Icon'] },
	],
}

const CHANNEL_MAP = {
	Channels: [
		{ Id: null, ChannelNumber: 1, StationId: '14098', ServiceCollectionId: '14193', Name: 'KTVU-2 (FOX)' },
		{ Id: null, ChannelNumber: 2, StationId: '11345', ServiceCollectionId: '14195', Name: 'KTVU-HD-2 (FOX)' },
		// MK's 3-up mosaic, cloned from the same station as `mv-test` (see the shared-station test),
		// plus its two spotlight variants — one channel each, all on that same station.
		{ Id: null, ChannelNumber: 4, StationId: '14098', ServiceCollectionId: '14240', Name: 'KTVU-2 (FOX)' },
		{ Id: null, ChannelNumber: 5, StationId: '14098', ServiceCollectionId: '14250', Name: 'KTVU-2 (FOX)' },
		{ Id: null, ChannelNumber: 6, StationId: '14098', ServiceCollectionId: '14251', Name: 'KTVU-2 (FOX)' },
	],
	ServiceCollections: [
		{ Id: '14193', ServiceItems: [{ ServiceId: '14216', ServiceGrouping: 0 }] },
		{ Id: '14195', ServiceItems: [{ ServiceId: '14194', ServiceGrouping: 0 }] },
		{ Id: '14240', ServiceItems: [{ ServiceId: '14236', ServiceGrouping: 0 }] },
		{ Id: '14250', ServiceItems: [{ ServiceId: '14237', ServiceGrouping: 0 }] },
		{ Id: '14251', ServiceItems: [{ ServiceId: '14238', ServiceGrouping: 0 }] },
	],
	Services: [
		{ Id: '14216', Type: 'HlsPlayback', ServiceIntent: 'FullScreen', MediaId: 'mv-test', QualityLevel: 'ReachHD' },
		{ Id: '14194', Type: 'HlsPlayback', ServiceIntent: 'FullScreen', MediaId: 'engage1', QualityLevel: 'ReachHD' },
		{ Id: '14236', Type: 'HlsPlayback', ServiceIntent: 'FullScreen', MediaId: 'mv-test-3us', QualityLevel: 'ReachHD' },
		{
			Id: '14237',
			Type: 'HlsPlayback',
			ServiceIntent: 'FullScreen',
			MediaId: 'mv-test-3us-b',
			QualityLevel: 'ReachHD',
		},
		{
			Id: '14238',
			Type: 'HlsPlayback',
			ServiceIntent: 'FullScreen',
			MediaId: 'mv-test-3us-c',
			QualityLevel: 'ReachHD',
		},
	],
}

const LIVE_RIGHTS = {
	channels: {
		'1': [{ q: 'ReachHD' }],
		'2': [{ q: 'ReachHD' }],
		'4': [{ q: 'ReachHD' }],
		'5': [{ q: 'ReachHD' }],
		'6': [{ q: 'ReachHD' }],
	},
}
const IP_STATUS = { InHome: 'Yes', InCountry: 'Yes' }

const feed: FeedDescriptor = {
	id: 'feed-1',
	name: 'On Now Custom Feed',
	uri: 'udl://discovery/feeds/feed-1',
	feedType: 'Custom',
	showcardAspectRatio: 'Mixed',
}

function mockApi(overrides: { feedItems?: unknown } = {}) {
	return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
		const url = String(input)
		const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

		if (url.includes('/feeds/')) return json(overrides.feedItems ?? CHANNEL_FEED)
		if (url.includes('/catalogcache')) return json(CHANNEL_MAP)
		if (url.includes('/rights/live/channel-map')) return json(LIVE_RIGHTS)
		if (url.includes('/ip-status/')) return json(IP_STATUS)
		throw new Error(`unexpected fetch: ${url}`)
	})
}

describe('custom feeds of live channels', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it('resolves station ids through the channel map into playable live cards', async () => {
		mockApi()
		const rail = await createMkApiProvider(config, 'tok').getRailData(feed)

		expect(rail?.variant).toBe('live')
		expect(rail?.items.map((i) => i.id)).toEqual(['engage1', 'mv-test'])
	})

	it('keeps the feed order rather than the channel-map order', async () => {
		mockApi()
		const rail = await createMkApiProvider(config, 'tok').getRailData(feed)

		// Feed lists 11345 first, the channel map sorts by channel number (14098 first).
		expect(rail?.items[0].title).toBe('KTVU-HD-2 (FOX)')
	})

	it('routes multiview channels to the mosaic player and regular ones to the title page', async () => {
		mockApi()
		const rail = await createMkApiProvider(config, 'tok').getRailData(feed)

		expect(rail?.items.find((i) => i.id === 'mv-test')?.href).toBe('/multiview?id=mv-test')
		expect(rail?.items.find((i) => i.id === 'engage1')?.href).toBe('/title?id=live-channel%3Aengage1')
	})

	// MK clones one station across several mosaics (IBC Sports: `mv-test` and `mv-test-3us` both
	// sit on 14098), and a curated feed can only name the station. Each mention must land on its
	// own channel, or the mosaics collapse onto whichever one the channel map lists last.
	it('gives each mention of a shared station its own channel, in channel-number order', async () => {
		mockApi({
			feedItems: {
				Uri: null,
				Items: [
					{ Id: '14098', Name: 'KTVU-2 (FOX)', ItemType: 'Channel' },
					{ Id: '14098', Name: 'KTVU-2 (FOX)', ItemType: 'Channel' },
					{ Id: '11345', Name: 'KTVU-HD-2 (FOX)', ItemType: 'Channel' },
				],
			},
		})
		const rail = await createMkApiProvider(config, 'tok').getRailData(feed)

		expect(rail?.items.map((i) => i.id)).toEqual(['mv-test', 'mv-test-3us', 'engage1'])
	})

	it('repeats the first channel when a station is named more often than the map carries it', async () => {
		mockApi({
			feedItems: {
				Uri: null,
				Items: [
					{ Id: '11345', Name: 'KTVU-HD-2 (FOX)', ItemType: 'Channel' },
					{ Id: '11345', Name: 'KTVU-HD-2 (FOX)', ItemType: 'Channel' },
				],
			},
		})
		const rail = await createMkApiProvider(config, 'tok').getRailData(feed)

		expect(rail?.items.map((i) => i.id)).toEqual(['engage1', 'engage1'])
	})

	// MK ships each 3-up spotlight as its own channel on the same station, so the curated feed
	// names that station once per variant. The rail has to show the mosaic once, not three times.
	it('shows one card per mosaic when the feed lists every spotlight variant', async () => {
		mockApi({
			feedItems: {
				Uri: null,
				Items: [
					{ Id: '14098', Name: 'KTVU-2 (FOX)', ItemType: 'Channel' },
					{ Id: '14098', Name: 'KTVU-2 (FOX)', ItemType: 'Channel' },
					{ Id: '14098', Name: 'KTVU-2 (FOX)', ItemType: 'Channel' },
					{ Id: '14098', Name: 'KTVU-2 (FOX)', ItemType: 'Channel' },
					{ Id: '11345', Name: 'KTVU-HD-2 (FOX)', ItemType: 'Channel' },
				],
			},
		})
		const rail = await createMkApiProvider(config, 'tok').getRailData(feed)

		expect(rail?.items.map((i) => i.id)).toEqual(['mv-test', 'mv-test-3us', 'engage1'])
	})

	it('skips channels missing from the channel map instead of dropping the rail', async () => {
		mockApi({
			feedItems: { Uri: null, Items: [...CHANNEL_FEED.Items, { Id: '99999', Name: 'Ghost', ItemType: 'Channel' }] },
		})
		const rail = await createMkApiProvider(config, 'tok').getRailData(feed)

		expect(rail?.items).toHaveLength(2)
	})

	it('returns null when no feed item resolves to a channel', async () => {
		mockApi({ feedItems: { Uri: null, Items: [{ Id: '99999', Name: 'Ghost', ItemType: 'Channel' }] } })
		const rail = await createMkApiProvider(config, 'tok').getRailData(feed)

		expect(rail).toBeNull()
	})

	it('fetches the channel map once when several rails need it', async () => {
		const fetchSpy = mockApi()
		const provider = createMkApiProvider(config, 'tok')

		await provider.getRailData(feed)
		await provider.getRailData({ ...feed, id: 'feed-2' })

		const channelMapCalls = fetchSpy.mock.calls.filter(([url]) => String(url).includes('/catalogcache'))
		expect(channelMapCalls).toHaveLength(1)
	})

	it('leaves ordinary catalog feeds on the standard mapping path', async () => {
		mockApi({
			feedItems: {
				Uri: null,
				Items: [
					{
						Id: 'prog-1',
						Name: 'A Movie',
						ItemType: 'Program',
						SupportedImages: ['16x9/Poster'],
						ImageBucketId: 'images',
					},
				],
			},
		})
		const rail = await createMkApiProvider(config, 'tok').getRailData(feed)

		expect(rail?.variant).toBe('backdrop')
		expect(rail?.items[0].href).toBe('/title?id=prog-1')
	})
})

describe('multiview spotlight variants', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it('hands the player every variant of the mosaic, in feed order', async () => {
		mockApi()
		const detail = await createMkApiProvider(config, 'tok').getTitleDetail('live-channel:mv-test-3us')

		expect(detail?.multiviewSpotlights).toEqual([
			{ feedKey: 'A', mediaId: 'mv-test-3us', applicationToken: '14240' },
			{ feedKey: 'B', mediaId: 'mv-test-3us-b', applicationToken: '14250' },
			{ feedKey: 'C', mediaId: 'mv-test-3us-c', applicationToken: '14251' },
		])
	})

	// Opening a variant directly must offer the same switch as opening the base.
	it('offers the same variants when a lettered variant is opened directly', async () => {
		mockApi()
		const detail = await createMkApiProvider(config, 'tok').getTitleDetail('live-channel:mv-test-3us-c')

		expect(detail?.mediaId).toBe('mv-test-3us-c')
		expect(detail?.multiviewSpotlights?.map((s) => s.feedKey)).toEqual(['A', 'B', 'C'])
	})

	// A lone mosaic has nothing to switch to; the player must not offer a dead control.
	it('leaves the spotlights off a mosaic MK ships without variants', async () => {
		mockApi()
		const detail = await createMkApiProvider(config, 'tok').getTitleDetail('live-channel:mv-test')

		expect(detail?.multiviewSpotlights).toBeUndefined()
	})

	it('leaves the spotlights off an ordinary live channel', async () => {
		mockApi()
		const detail = await createMkApiProvider(config, 'tok').getTitleDetail('live-channel:engage1')

		expect(detail?.multiviewSpotlights).toBeUndefined()
	})
})
