import { describe, expect, it } from 'vitest'
import type { MediaItem } from '../../../types/media'
import { toSearchResultsRail } from '../mappers'

const makeItem = (overrides: Partial<MediaItem> = {}): MediaItem => ({
	id: 'test-1',
	kind: 'movie',
	title: 'Test Movie',
	poster: { src: 'https://img.test/poster.jpg' },
	backdrop: { src: 'https://img.test/backdrop.jpg' },
	...overrides,
})

describe('toSearchResultsRail', () => {
	it('creates correct RailData shape', () => {
		const items = [makeItem()]
		const rail = toSearchResultsRail(items, 'action')

		expect(rail).toMatchObject({
			id: 'search-results',
			title: 'Results for "action"',
			variant: 'poster',
		})
		expect(rail.items).toHaveLength(1)
	})

	it('uses poster image for card imageUrl', () => {
		const items = [makeItem({ poster: { src: 'poster.jpg' }, backdrop: { src: 'backdrop.jpg' } })]
		const rail = toSearchResultsRail(items, 'q')

		expect(rail.items[0]?.imageUrl).toBe('poster.jpg')
	})

	it('falls back to backdrop when no poster', () => {
		const items = [makeItem({ poster: undefined, backdrop: { src: 'backdrop.jpg' } })]
		const rail = toSearchResultsRail(items, 'q')

		expect(rail.items[0]?.imageUrl).toBe('backdrop.jpg')
	})

	it('falls back to empty string when no images', () => {
		const items = [makeItem({ poster: undefined, backdrop: undefined })]
		const rail = toSearchResultsRail(items, 'q')

		expect(rail.items[0]?.imageUrl).toBe('')
	})

	it('sets correct href pattern /title?id={id}', () => {
		const items = [makeItem({ id: 'movie-42' })]
		const rail = toSearchResultsRail(items, 'q')

		expect(rail.items[0]?.href).toBe('/title?id=movie-42')
	})

	it('sets variant to poster on each item', () => {
		const items = [makeItem()]
		const rail = toSearchResultsRail(items, 'q')

		expect(rail.items[0]?.variant).toBe('poster')
	})

	it('handles empty results array', () => {
		const rail = toSearchResultsRail([], 'empty')

		expect(rail.items).toEqual([])
		expect(rail.title).toBe('Results for "empty"')
	})
})
