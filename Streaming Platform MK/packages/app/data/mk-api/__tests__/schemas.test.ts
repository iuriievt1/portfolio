import { describe, expect, it } from 'vitest'
import { appConfigSchema } from '../schemas'

const validConfig = {
	mkApiHost: 'https://api.example.com',
	tenantId: 'tenant1',
	storeId: 'store-1',
	imageBaseUrl: 'https://images.example.com',
	groups: 'group1',
	profileId: 'profile-1',
	locationDetail: 'US',
	discoveryUrl: 'https://discovery.example.com',
	subscriberServiceUrl: 'https://sub.example.com',
	catalogCacheUrl: 'https://catalog.example.com/catalogcache',
	searchServiceUrl: 'https://search.example.com',
	stsServiceUrl: 'https://sts.example.com',
	playerServerUrl: 'https://player.example.com',
	channelMapId: 660080,
	navHubIds: {
		home: 'hub-home',
	},
	feedDisplayTypes: {
		jumboFeedIds: ['feed-1', 'feed-2'],
		characterFeedIds: ['char-1'],
	},
	continueWatchingUdl: 'udl://continue',
	favouritesUdl: 'udl://favourites',
}

describe('appConfigSchema', () => {
	it('accepts valid config', () => {
		const result = appConfigSchema.safeParse(validConfig)

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.mkApiHost).toBe('https://api.example.com')
			expect(result.data.tenantId).toBe('tenant1')
		}
	})

	it('rejects when mkApiHost is missing', () => {
		const { mkApiHost, ...incomplete } = validConfig
		const result = appConfigSchema.safeParse(incomplete)

		expect(result.success).toBe(false)
	})

	it('rejects when tenantId is missing', () => {
		const { tenantId, ...incomplete } = validConfig
		const result = appConfigSchema.safeParse(incomplete)

		expect(result.success).toBe(false)
	})

	it('rejects when mkApiHost is empty string', () => {
		const result = appConfigSchema.safeParse({ ...validConfig, mkApiHost: '' })

		expect(result.success).toBe(false)
	})

	it('rejects when navHubIds is missing', () => {
		const { navHubIds, ...incomplete } = validConfig
		const result = appConfigSchema.safeParse(incomplete)

		expect(result.success).toBe(false)
	})

	it('accepts when navHubIds.home is missing (defaults to empty string)', () => {
		const result = appConfigSchema.safeParse({
			...validConfig,
			navHubIds: {},
		})

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.navHubIds.home).toBe('')
		}
	})

	it('strips extra fields', () => {
		const result = appConfigSchema.safeParse({
			...validConfig,
			extraField: 'should-be-stripped',
			anotherExtra: 42,
		})

		expect(result.success).toBe(true)
		if (result.success) {
			expect('extraField' in result.data).toBe(false)
			expect('anotherExtra' in result.data).toBe(false)
		}
	})

	it('accepts empty arrays in feedDisplayTypes', () => {
		const result = appConfigSchema.safeParse({
			...validConfig,
			feedDisplayTypes: {
				jumboFeedIds: [],
				characterFeedIds: [],
			},
		})

		expect(result.success).toBe(true)
	})

	it('rejects when feedDisplayTypes is missing', () => {
		const { feedDisplayTypes, ...incomplete } = validConfig
		const result = appConfigSchema.safeParse(incomplete)

		expect(result.success).toBe(false)
	})

	it('accepts empty strings for optional-like fields', () => {
		const result = appConfigSchema.safeParse({
			...validConfig,
			storeId: '',
			searchServiceUrl: '',
			stsServiceUrl: '',
			playerServerUrl: '',
			locationDetail: '',
			groups: '',
		})

		expect(result.success).toBe(true)
	})
})
