import type { ContinueItem } from '@pkg/design-system'
import { describe, expect, it } from 'vitest'
import {
	LIVE_CHANNEL_TITLE_ID_PREFIX,
	mapContinueWatchingToRail,
	mapFeedItemsToHero,
	mapFeedItemsToRail,
	mapPlayableChannelsToRail,
	mapPlayersToRail,
	mapPlayOptionsToTitleDetail,
} from '../mappers'
import type {
	DiscoveryFeedItemsResponse,
	PlayableChannel,
	ProgramTitle,
	SubscriberContinueWatchingResponse,
} from '../types'

// ── Minimal fixtures ────────────────────────────────────────

const heroResponse: DiscoveryFeedItemsResponse = {
	Uri: null,
	Items: [
		{
			Id: 'HERO_1',
			Name: 'Avalanche vs Stars',
			ItemType: 'Program',
			ShowType: 'Movie',
			SupportedImages: ['16x9/poster'],
			ImageBucketId: 'bucket-1',
			IsAdult: false,
			IsGeneric: false,
		},
	],
}

const railResponse: DiscoveryFeedItemsResponse = {
	Uri: null,
	Items: [
		{
			Id: 'RAIL_ITEM_1',
			Name: 'Colorado Classic',
			ItemType: 'Program',
			ShowType: 'Movie',
			SupportedImages: ['16x9/poster'],
			ImageBucketId: 'bucket-3',
			Ratings: [{ System: 'MPAA', Value: 'R' }],
			IsAdult: true,
			IsGeneric: false,
		},
	],
}

const cwResponse: SubscriberContinueWatchingResponse = {
	Libaries: {},
	LibraryItems: [
		{
			Id: 'CW_1',
			ItemType: 'Program',
			IsPinned: false,
			IsEpisodeHidden: false,
			Bookmark: {
				TimeSeconds: 1200,
				ProgramId: 'CW_1',
				EpisodeNumber: 3,
				BookmarkType: 'Normal',
				Id: 'bk-1',
				SeasonId: 'season-1',
				RuntimeSeconds: 3600,
			},
			PlayActions: [],
			CatalogInfo: {
				Name: 'Season Opener',
				ShowType: 'Episode',
				UniversalProgramId: 'upid-1',
				RuntimeSeconds: 3600,
				Ratings: [],
				Tags: [],
				IsAdult: false,
				SeriesId: 'series-1',
				EpisodeName: 'The Comeback',
				SeasonNumber: 2,
				SeasonId: 'season-1',
				EpisodeNumber: '3',
				Locale: 'en-US',
				HasContentAdvisory: false,
				AvailableUtc: '2026-01-01T00:00:00Z',
				ImageBucketId: 'bucket-4',
				SupportedImages: ['16x9/poster'],
			},
			IsContentRestrictedForGeolocation: false,
			IsContentFree: false,
			IsLastChance: true,
		},
		{
			Id: 'CW_NO_BOOKMARK',
			ItemType: 'Program',
			IsPinned: false,
			IsEpisodeHidden: false,
			PlayActions: [],
			CatalogInfo: {
				Name: 'No Progress',
				ShowType: 'Movie',
				UniversalProgramId: 'upid-2',
				RuntimeSeconds: 5400,
				Ratings: [],
				Tags: [],
				IsAdult: false,
				SeriesId: '',
				EpisodeName: '',
				SeasonNumber: 0,
				SeasonId: '',
				EpisodeNumber: '',
				Locale: 'en-US',
				HasContentAdvisory: false,
				AvailableUtc: '2026-01-01T00:00:00Z',
				ImageBucketId: 'bucket-5',
				SupportedImages: [],
			},
			IsContentRestrictedForGeolocation: false,
			IsContentFree: false,
			IsLastChance: false,
		},
	],
}

const stub = () => 'https://img.test/stub.jpg'

const titleResponse: ProgramTitle = {
	Id: 'TITLE_1',
	ItemType: 'Program',
	IsPinned: false,
	IsEpisodeHidden: false,
	IsGeoBlocked: false,
	PlayActions: [
		{
			OfferId: 'offer-1',
			ExternalOfferId: 'external-offer-1',
			VideoProfile: {
				PlaybackUri: 'https://stream.test/master.m3u8',
				PlaybackOrigin: 'origin',
				Id: 'video-profile-1',
				Owner: 'tenant1',
				Encoding: 'HLS',
				QualityLevel: 'SD',
				ClientType: 'Web',
			},
			ExpirationUtc: '2026-01-01T00:00:00Z',
			TimeToExpiry: 'PT1H',
			HoursToExpiry: 1,
			StartUtc: '2026-01-01T00:00:00Z',
			Restrictions: [],
		},
	],
	CatalogInfo: {
		Name: 'Title One',
		ShowType: 'Movie',
		UniversalProgramId: 'upid-title-1',
		RuntimeSeconds: 3600,
		Ratings: [],
		Tags: [],
		IsAdult: false,
	},
}

// ── Logic-only tests ────────────────────────────────────────

describe('mapFeedItemsToHero', () => {
	it('merges enrichment data via spread', () => {
		const enrichment = { HERO_1: { synopsis: 'A thrilling match', year: 2026 } }
		const result = mapFeedItemsToHero(heroResponse, stub, enrichment)

		expect(result.items[0]).toMatchObject({ synopsis: 'A thrilling match', year: 2026 })
	})
})

describe('mapFeedItemsToRail', () => {
	it('coerces IsAdult false to undefined', () => {
		const response: DiscoveryFeedItemsResponse = {
			Uri: null,
			Items: [{ ...railResponse.Items[0], IsAdult: false }],
		}
		const result = mapFeedItemsToRail('feed-1', 'Test', response, 'backdrop', stub)

		expect(result.items[0]?.isAdult).toBeUndefined()
	})

	it('omits the aspect when the feed declares none', () => {
		const result = mapFeedItemsToRail('feed-1', 'Test', railResponse, 'backdrop', stub)

		expect(result.aspect).toBeUndefined()
	})

	// A FourByThree feed keeps the backdrop card's behaviour but renders (and requests) 4x3.
	it('carries the declared aspect and asks for its artwork ratio', () => {
		const layouts: string[] = []
		const spy = (_item: unknown, layout: string) => {
			layouts.push(layout)
			return 'https://img.test/stub.jpg'
		}

		const result = mapFeedItemsToRail('feed-1', 'Dotscreen', railResponse, 'backdrop', spy, '4x3')

		expect(result.aspect).toBe('4x3')
		expect(result.variant).toBe('backdrop')
		expect(layouts).toEqual(['4x3'])
	})

	it('maps a 3x4 feed onto the poster card', () => {
		const result = mapFeedItemsToRail('feed-1', 'Portrait', railResponse, 'poster', stub, '3x4')

		expect(result.aspect).toBe('3x4')
		expect(result.variant).toBe('poster')
	})
})

describe('mapPlayersToRail', () => {
	it('maps players to a character rail', () => {
		const result = mapPlayersToRail({
			feedId: 'players-feed',
			title: 'Players',
			players: [
				{
					Id: 'player-1',
					Name: 'Logo 1',
					SportsType: 'Ice hockey',
					SupportedImages: ['1x1/KeyArt'],
					ImageBucketId: 'images',
				},
			],
			resolveImage: stub,
		})

		expect(result).toMatchObject({
			id: 'players-feed',
			title: 'Players',
			variant: 'character',
			items: [
				{
					id: 'player-1',
					title: 'Logo 1',
					subtitle: 'Ice hockey',
					imageUrl: 'https://img.test/stub.jpg',
					href: '#',
					variant: 'character',
				},
			],
		})
	})
})

describe('mapPlayableChannelsToRail', () => {
	it('maps playable channels to title detail links', () => {
		const channels: PlayableChannel[] = [
			{
				id: 'channel-1',
				title: 'KTVUHD',
				channelLabel: 'KTVU',
				showLabel: 'KTVU-HD-2 (FOX)',
				channelNumber: 2,
				imageUrl: 'https://img.test/channel.jpg',
				mediaId: 'media-1',
				ownerId: 'tenant1',
			},
		]

		const result = mapPlayableChannelsToRail('live-feed', 'Live Channels', channels)

		expect(result.variant).toBe('live')
		expect(result.items[0]).toMatchObject({
			id: 'channel-1',
			title: 'KTVUHD',
			href: `/title?id=${encodeURIComponent(`${LIVE_CHANNEL_TITLE_ID_PREFIX}channel-1`)}`,
			variant: 'live',
			live: {
				channel: 'KTVU',
				show: 'KTVU-HD-2 (FOX)',
			},
		})
	})

	const multiviewChannel: PlayableChannel = {
		id: 'mv-test',
		title: 'KTVU-2 (FOX)',
		channelLabel: 'KTVU',
		showLabel: 'KTVU-2 (FOX)',
		channelNumber: 1,
		imageUrl: 'https://img.test/mv.jpg',
		mediaId: 'mv-test',
		ownerId: 'tenant1',
		isMultiview: true,
		multiviewFeedCount: 4,
	}

	const normalChannel: PlayableChannel = {
		id: 'engage1',
		title: 'KTVU-HD-2 (FOX)',
		channelLabel: 'KTVUHD',
		showLabel: 'KTVU-HD-2 (FOX)',
		channelNumber: 2,
		imageUrl: 'https://img.test/live.jpg',
		mediaId: 'engage1',
		ownerId: 'tenant1',
	}

	it('renders an all-multiview rail as the mosaic-card variant with a feed-count badge', () => {
		const result = mapPlayableChannelsToRail('mv-feed', 'Multi View', [multiviewChannel])

		expect(result.variant).toBe('multiview')
		expect(result.items[0]).toMatchObject({
			id: 'mv-test',
			title: 'Ultra',
			href: '/multiview?id=mv-test',
			variant: 'multiview',
			multiviewCount: 4,
		})
	})

	// A 2-up mosaic must show the 2 badge, not the 4 the count used to be hardcoded to.
	it('badges each mosaic with its own feed count', () => {
		const twoUp: PlayableChannel = { ...multiviewChannel, id: 'mv-2up', mediaId: 'mv-2up', multiviewFeedCount: 2 }
		const result = mapPlayableChannelsToRail('mv-feed', 'Multi View', [twoUp, multiviewChannel])

		expect(result.items.map((item) => (item.variant === 'multiview' ? item.multiviewCount : null))).toEqual([2, 4])
	})

	it('leaves the badge off a mosaic whose feed count is unknown', () => {
		const unnamed: PlayableChannel = { ...multiviewChannel, multiviewFeedCount: undefined }
		const item = mapPlayableChannelsToRail('mv-feed', 'Multi View', [unnamed]).items[0]

		expect(item.variant === 'multiview' && item.multiviewCount).toBeUndefined()
	})

	// The channel map names every mosaic after the station it was cloned from, so the cards read
	// "KTVU-2 (FOX)" and repeat each other. MK cannot rename them, so the names are ours.
	it('names each mosaic card after its feed count', () => {
		const mosaic = (count: number, id: string): PlayableChannel => ({
			...multiviewChannel,
			id,
			mediaId: id,
			multiviewFeedCount: count,
		})
		const result = mapPlayableChannelsToRail('mv-feed', 'Multi View', [mosaic(2, 'a'), mosaic(3, 'b'), mosaic(4, 'c')])

		expect(result.items.map((item) => item.title)).toEqual(['Duo', 'Prime', 'Ultra'])
	})

	it('falls back to Multiview when the feed count is unknown', () => {
		const unnamed: PlayableChannel = { ...multiviewChannel, multiviewFeedCount: undefined }

		expect(mapPlayableChannelsToRail('mv-feed', 'Multi View', [unnamed]).items[0].title).toBe('Multiview')
	})

	it('names a mosaic the same way when it sits in a live rail', () => {
		const result = mapPlayableChannelsToRail('on-now', 'On Now', [normalChannel, multiviewChannel])

		expect(result.items.map((item) => item.title)).toEqual(['KTVU-HD-2 (FOX)', 'Ultra'])
	})

	it('leaves ordinary live channels named after their channel', () => {
		const result = mapPlayableChannelsToRail('on-now', 'On Now', [normalChannel])

		expect(result.items[0].title).toBe('KTVU-HD-2 (FOX)')
	})

	it('does not put a metaLine on multiview cards (backend has no per-feed metadata)', () => {
		const item = mapPlayableChannelsToRail('mv-feed', 'Multi View', [multiviewChannel]).items[0]

		expect(item).not.toHaveProperty('metaLine')
	})

	it('keeps a live rail when channels are not all multiview, routing MV channels to the mosaic player', () => {
		const result = mapPlayableChannelsToRail('on-now', 'On Now', [normalChannel, multiviewChannel])

		expect(result.variant).toBe('live')
		expect(result.items.map((i) => i.variant)).toEqual(['live', 'live'])
		expect(result.items[1].href).toBe('/multiview?id=mv-test')
	})

	it('stays a live rail when there are no channels', () => {
		const result = mapPlayableChannelsToRail('empty', 'Empty', [])

		expect(result.variant).toBe('live')
		expect(result.items).toHaveLength(0)
	})
})

describe('mapContinueWatchingToRail', () => {
	it('filters out items without bookmarks', () => {
		const result = mapContinueWatchingToRail(cwResponse, stub)

		expect(result.items).toHaveLength(1)
		expect(result.items[0]?.id).toBe('CW_1')
	})

	it('calculates progress as TimeSeconds / RuntimeSeconds', () => {
		const item = mapContinueWatchingToRail(cwResponse, stub).items[0] as ContinueItem

		expect(item.progress).toBeCloseTo(0.333, 2)
	})

	it('formats episode label as S2 E3 · The Comeback', () => {
		const item = mapContinueWatchingToRail(cwResponse, stub).items[0] as ContinueItem

		expect(item.episodeLabel).toBe('S2 E3 · The Comeback')
	})

	it('passes the raw CW item to the image resolver so callers can use CatalogInfo.Images', () => {
		const captured: unknown[] = []
		const capturingResolver = (item: SubscriberContinueWatchingResponse['LibraryItems'][number]) => {
			captured.push(item)
			return item.CatalogInfo.Images?.[0]?.Uri ?? ''
		}

		const responseWithImages: SubscriberContinueWatchingResponse = {
			...cwResponse,
			LibraryItems: [
				{
					...cwResponse.LibraryItems[0]!,
					CatalogInfo: {
						...cwResponse.LibraryItems[0]!.CatalogInfo,
						SupportedImages: ['2x3/Poster', 'PosterLandscape'],
						Images: [{ Size: 'Medium', ImageType: 'PosterLandscape', Uri: 'https://img.test/landscape.jpg' }],
					},
				},
			],
		}

		const item = mapContinueWatchingToRail(responseWithImages, capturingResolver).items[0] as ContinueItem

		expect(captured).toHaveLength(1)
		expect(item.imageUrl).toBe('https://img.test/landscape.jpg')
	})
})

describe('mapPlayOptionsToTitleDetail', () => {
	it('maps registered playback fields required by MKPlayer', () => {
		const result = mapPlayOptionsToTitleDetail('program-1', titleResponse)

		expect(result).toMatchObject({
			assetType: 'vod',
			mediaId: 'video-profile-1',
			offerId: 'offer-1',
			ownerUid: 'tenant1',
			playbackUrl: 'https://stream.test/master.m3u8',
		})
	})
})
