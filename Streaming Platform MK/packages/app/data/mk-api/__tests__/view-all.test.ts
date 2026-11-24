import { describe, expect, it } from 'vitest'
import { buildFeedViewAll } from '../mappers'

const base = {
	id: 'FEED_1',
	uri: 'udl://discovery/feeds/FEED_1',
	navigationTargetUri: 'browsemovies',
	navigationTargetText: 'Browse all Movies',
	navigationTargetVisibility: 'Always',
}

describe('buildFeedViewAll', () => {
	it('returns a query-param href routed by feed id and a fixed "View all" label', () => {
		expect(buildFeedViewAll(base)).toEqual({ href: '/browse?feed=FEED_1', label: 'View all' })
	})

	it('keeps the "View all" label regardless of NavigationTargetText', () => {
		expect(buildFeedViewAll({ ...base, navigationTargetText: 'Browse all Movies' })).toEqual({
			href: '/browse?feed=FEED_1',
			label: 'View all',
		})
	})

	it('returns null when visibility is not Always', () => {
		expect(buildFeedViewAll({ ...base, navigationTargetVisibility: 'Hidden' })).toBeNull()
	})

	it('returns null when NavigationTargetUri is missing', () => {
		expect(buildFeedViewAll({ ...base, navigationTargetUri: undefined })).toBeNull()
	})

	it('returns null for non-discovery feeds (e.g. live channels)', () => {
		expect(buildFeedViewAll({ ...base, uri: 'udl://live/feeds/playableChannels/' })).toBeNull()
	})

	it('encodes the feed id in the href', () => {
		expect(buildFeedViewAll({ ...base, id: 'a/b id' })?.href).toBe('/browse?feed=a%2Fb%20id')
	})
})
