import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMkApiProvider } from '../provider'
import type { AppConfig } from '../types'

const baseConfig: AppConfig = {
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
	channelMapId: null,
	navHubIds: { home: '' },
	feedDisplayTypes: { jumboFeedIds: [], characterFeedIds: [] },
	continueWatchingUdl: '',
	favouritesUdl: '',
} as unknown as AppConfig

describe('createMkApiProvider.putBookmark', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it('issues a PUT to /subscriberbkmark/v3/videos/{videoId}/bookmark with correct URL, headers and body', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
		const provider = createMkApiProvider(baseConfig, 'anon-token', 'user-token', 'profile-7')

		await provider.putBookmark({ videoId: 'tenant1_prog_42', timeSeconds: 123.7, runtimeSeconds: 3600.2 })

		expect(fetchSpy).toHaveBeenCalledTimes(1)
		const [url, init] = fetchSpy.mock.calls[0]
		expect(url).toBe(
			'https://api.example.com/subscriberbkmark/v3/videos/tenant1_prog_42/bookmark?storeId=HubsAndFeeds-%21tenant1%21Main',
		)
		expect(init?.method).toBe('PUT')
		const headers = init?.headers as Record<string, string>
		expect(headers.Authorization).toBe('OAUTH2 access_token="user-token"')
		expect(headers['x-tv3-profiles']).toBe('profile-7')
		expect(headers['Content-Type']).toBe('application/json')
		expect((init as RequestInit & { keepalive?: boolean }).keepalive).toBe(true)
		expect(JSON.parse(init?.body as string)).toEqual({ TimeSeconds: 123 })
	})

	it('URL-encodes the videoId', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
		const provider = createMkApiProvider(baseConfig, 'anon-token', 'user-token', 'profile-7')

		await provider.putBookmark({ videoId: 'foo bar/baz', timeSeconds: 1, runtimeSeconds: 100 })

		const [url] = fetchSpy.mock.calls[0]
		expect(url).toContain('/videos/foo%20bar%2Fbaz/bookmark')
	})

	it('no-ops when userAccessToken is missing', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
		const provider = createMkApiProvider(baseConfig, 'anon-token', null, 'profile-7')

		await provider.putBookmark({ videoId: 'x', timeSeconds: 10, runtimeSeconds: 100 })

		expect(fetchSpy).not.toHaveBeenCalled()
	})

	it('no-ops when userProfileId is missing', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
		const provider = createMkApiProvider(baseConfig, 'anon-token', 'user-token', null)

		await provider.putBookmark({ videoId: 'x', timeSeconds: 10, runtimeSeconds: 100 })

		expect(fetchSpy).not.toHaveBeenCalled()
	})

	it('no-ops when videoId is empty', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
		const provider = createMkApiProvider(baseConfig, 'anon-token', 'user-token', 'profile-7')

		await provider.putBookmark({ videoId: '', timeSeconds: 10, runtimeSeconds: 100 })

		expect(fetchSpy).not.toHaveBeenCalled()
	})

	it('no-ops when runtimeSeconds is 0', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
		const provider = createMkApiProvider(baseConfig, 'anon-token', 'user-token', 'profile-7')

		await provider.putBookmark({ videoId: 'x', timeSeconds: 10, runtimeSeconds: 0 })

		expect(fetchSpy).not.toHaveBeenCalled()
	})

	it('swallows fetch errors and does not throw', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))
		const provider = createMkApiProvider(baseConfig, 'anon-token', 'user-token', 'profile-7')

		await expect(provider.putBookmark({ videoId: 'x', timeSeconds: 10, runtimeSeconds: 100 })).resolves.toBeUndefined()
	})
})
