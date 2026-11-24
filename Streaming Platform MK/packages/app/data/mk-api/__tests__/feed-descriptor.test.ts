import { describe, expect, it } from 'vitest'
import { toFeedDescriptor } from '../provider'

describe('toFeedDescriptor', () => {
	it('maps hub feed fields including NavigationTarget config', () => {
		expect(
			toFeedDescriptor({
				Id: 'FEED_1',
				Name: 'Spotlight',
				Uri: 'udl://discovery/feeds/FEED_1',
				FeedType: 'Custom',
				Layout: 'Gallery',
				ShowcardAspectRatio: 'SixteenByNine',
				DefaultSortType: 'Popularity',
				NavigationTargetUri: 'browsemovies',
				NavigationTargetText: 'Browse all Movies',
				NavigationTargetVisibility: 'Always',
			}),
		).toEqual({
			id: 'FEED_1',
			name: 'Spotlight',
			uri: 'udl://discovery/feeds/FEED_1',
			feedType: 'Custom',
			layout: 'Gallery',
			showcardAspectRatio: 'SixteenByNine',
			defaultSortType: 'Popularity',
			navigationTargetUri: 'browsemovies',
			navigationTargetText: 'Browse all Movies',
			navigationTargetVisibility: 'Always',
		})
	})
})
