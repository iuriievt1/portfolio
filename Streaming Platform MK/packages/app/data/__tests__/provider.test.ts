import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the dynamic imports so we don't pull in real providers
vi.mock('../mock-provider', () => ({
	createMockDataProvider: vi.fn().mockResolvedValue({
		getPageFeedManifest: vi.fn(),
		getHeroData: vi.fn(),
		getRailData: vi.fn(),
		getBrowseRailPage: vi.fn(),
		getTitleDetail: vi.fn(),
		putBookmark: vi.fn(),
		getBookmark: vi.fn(),
		resetCaches: vi.fn(),
	}),
}))

vi.mock('../mk-api-provider', () => ({
	createMkApiDataProvider: vi.fn().mockResolvedValue({
		getPageFeedManifest: vi.fn(),
		getHeroData: vi.fn(),
		getRailData: vi.fn(),
		getBrowseRailPage: vi.fn(),
		getTitleDetail: vi.fn(),
		putBookmark: vi.fn(),
		getBookmark: vi.fn(),
		resetCaches: vi.fn(),
	}),
}))

describe('getDataProvider', () => {
	beforeEach(() => {
		vi.stubEnv('DATA_SOURCE', 'mock')
		// Reset module cache so the singleton _providerPromise resets
		vi.resetModules()
	})

	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it('returns same instance on repeated calls', async () => {
		const { getDataProvider } = await import('../provider')
		const first = getDataProvider()
		const second = getDataProvider()

		expect(first).toBe(second)

		const provider1 = await first
		const provider2 = await second
		expect(provider1).toBe(provider2)
	})

	it('clears cache on rejection so next call retries', async () => {
		const { getDataProvider } = await import('../provider')

		// Make mock-provider fail on first call
		const mockMod = await import('../mock-provider')
		const createMock = vi.mocked(mockMod.createMockDataProvider)
		createMock.mockRejectedValueOnce(new Error('init failed'))

		await expect(getDataProvider()).rejects.toThrow('init failed')

		// Second call should retry (not return the cached rejection)
		createMock.mockResolvedValueOnce({
			getPageFeedManifest: vi.fn(),
			getHeroData: vi.fn(),
			getRailData: vi.fn(),
			getTitleDetail: vi.fn(),
			putBookmark: vi.fn(),
			getBookmark: vi.fn(),
			resetCaches: vi.fn(),
		})

		const provider = await getDataProvider()
		expect(provider).toBeDefined()
		expect(provider.getPageFeedManifest).toBeDefined()
	})

	it('returns mock provider when DATA_SOURCE=mock', async () => {
		vi.stubEnv('DATA_SOURCE', 'mock')
		const { getDataProvider } = await import('../provider')

		const provider = await getDataProvider()
		expect(provider).toBeDefined()
		expect(provider.resetCaches).toBeDefined()
	})

	it('exposes getBrowseRailPage on the provider contract', async () => {
		vi.stubEnv('DATA_SOURCE', 'mock')
		const { getDataProvider } = await import('../provider')
		const provider = await getDataProvider()
		expect(typeof provider.getBrowseRailPage).toBe('function')
	})

	it('applies the rail display limit to whatever the source returns', async () => {
		vi.stubEnv('DATA_SOURCE', 'mock')
		const mockMod = await import('../mock-provider')
		const source = await vi.mocked(mockMod.createMockDataProvider)()
		vi.mocked(source.getRailData).mockResolvedValue({
			id: 'FEED_1',
			title: 'Trending',
			variant: 'backdrop',
			items: Array.from({ length: 12 }, (_, i) => ({
				variant: 'backdrop' as const,
				id: `item-${i}`,
				title: `Item ${i}`,
				imageUrl: '',
				href: '',
			})),
			viewAllHref: '/browse?feed=FEED_1',
			viewAllLabel: 'View all',
		})

		const { getDataProvider } = await import('../provider')
		const provider = await getDataProvider()
		const rail = await provider.getRailData({ id: 'FEED_1', name: 'Trending', uri: 'udl://discovery/feeds/FEED_1' })

		expect(rail?.items).toHaveLength(12)
		expect(rail?.viewAllHref).toBeUndefined()
	})

	it('passes null rails through untouched', async () => {
		vi.stubEnv('DATA_SOURCE', 'mock')
		const mockMod = await import('../mock-provider')
		const source = await vi.mocked(mockMod.createMockDataProvider)()
		vi.mocked(source.getRailData).mockResolvedValue(null)

		const { getDataProvider } = await import('../provider')
		const provider = await getDataProvider()

		expect(await provider.getRailData({ id: 'X', name: 'X', uri: 'udl://discovery/feeds/X' })).toBeNull()
	})
})
