import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMkApiProvider } from '../provider'
import type { AppConfig, DiscoveryHubsResponse, Item } from '../types'

const config = {
	discoveryUrl: 'https://disco.example',
	groups: 'grp',
	storeId: 'store1',
	subscriberServiceUrl: 'https://sub.example',
	catalogCacheUrl: 'https://cache.example',
	imageBaseUrl: 'https://img.example',
} as unknown as AppConfig

function jsonResponse(body: unknown) {
	return { ok: true, json: async () => body } as Response
}

function item(id: string): Item {
	return {
		Id: id,
		Name: id,
		ItemType: 'Program',
		ShowType: '',
		SupportedImages: [],
		ImageBucketId: '',
		IsAdult: false,
		IsGeneric: false,
	}
}

/** Single-hub response exposing one standard discovery feed so findFeedDescriptor resolves it. */
function hubsWithFeed(feedId: string): DiscoveryHubsResponse {
	return [
		{
			Id: 'HUB_1',
			Name: 'Home',
			Feeds: [{ Id: feedId, Name: 'Movies', Uri: `udl://discovery/feeds/${feedId}` }],
		},
	] as unknown as DiscoveryHubsResponse
}

afterEach(() => vi.unstubAllGlobals())

describe('fetchFeedItems paging params', () => {
	it('sends default $top/$skip when no opts are given', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ Uri: null, Items: [] }))
		vi.stubGlobal('fetch', fetchMock)

		const provider = createMkApiProvider(config, 'tok')
		await provider.fetchFeedItems('FEED_1')

		const url = decodeURIComponent(fetchMock.mock.calls[0][0] as string)
		expect(url).toContain('$top=25')
		expect(url).toContain('$skip=0')
	})

	it('threads skip/top into the request URL', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ Uri: null, Items: [] }))
		vi.stubGlobal('fetch', fetchMock)

		const provider = createMkApiProvider(config, 'tok')
		await provider.fetchFeedItems('FEED_1', { skip: 20, top: 10 })

		const url = decodeURIComponent(fetchMock.mock.calls[0][0] as string)
		expect(url).toContain('/v4/feeds/FEED_1/items')
		expect(url).toContain('$top=10')
		expect(url).toContain('$skip=20')
	})
})

describe('getBrowseRailPage', () => {
	it('requests the page at the given skip and reports hasMore on a full page', async () => {
		const fullPage = Array.from({ length: 25 }, (_, i) => item(`m${i}`))
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes('/v3/hubs')) return Promise.resolve(jsonResponse(hubsWithFeed('FEED_1')))
			return Promise.resolve(jsonResponse({ Uri: null, Items: fullPage }))
		})
		vi.stubGlobal('fetch', fetchMock)

		const provider = createMkApiProvider(config, 'tok')
		const result = await provider.getBrowseRailPage('FEED_1', 25)

		const itemsUrl = decodeURIComponent(
			fetchMock.mock.calls.map((c) => c[0] as string).find((u) => u.includes('/items')) ?? '',
		)
		expect(itemsUrl).toContain('$skip=25')
		expect(itemsUrl).toContain('$top=25')
		expect(result?.rail.items).toHaveLength(25)
		expect(result?.hasMore).toBe(true)
		expect(result?.nextSkip).toBe(50)
	})

	it('reports no more pages when a short page comes back', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes('/v3/hubs')) return Promise.resolve(jsonResponse(hubsWithFeed('FEED_1')))
			return Promise.resolve(jsonResponse({ Uri: null, Items: [item('a'), item('b')] }))
		})
		vi.stubGlobal('fetch', fetchMock)

		const provider = createMkApiProvider(config, 'tok')
		const result = await provider.getBrowseRailPage('FEED_1', 0)

		expect(result?.rail.items).toHaveLength(2)
		expect(result?.hasMore).toBe(false)
	})

	it('returns null when the feed id is not found', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse(hubsWithFeed('OTHER_FEED')))
		vi.stubGlobal('fetch', fetchMock)

		const provider = createMkApiProvider(config, 'tok')
		expect(await provider.getBrowseRailPage('MISSING', 0)).toBeNull()
	})
})
