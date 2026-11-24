import { describe, expect, it } from 'vitest'
import type { MediaItem } from '../../../types/media'
import { toGenreRailData } from '../mappers'

const makeItem = (overrides: Partial<MediaItem> = {}): MediaItem => ({
	id: 'item-1',
	kind: 'movie',
	title: 'Test Item',
	poster: { src: 'https://img.test/poster.jpg' },
	backdrop: { src: 'https://img.test/backdrop.jpg' },
	...overrides,
})

describe('toGenreRailData', () => {
	it('creates correct RailData shape', () => {
		const rail = toGenreRailData('Action', 'poster', [makeItem()])

		expect(rail).toMatchObject({
			id: 'genre-grid',
			title: 'Action',
			variant: 'poster',
			showCardTitle: true,
		})
		expect(rail.items).toHaveLength(1)
	})

	it('uses the variant passed as input', () => {
		const rail = toGenreRailData('Comedy', 'backdrop', [makeItem()])

		expect(rail.variant).toBe('backdrop')
	})

	it('maps items through toRailItem correctly', () => {
		const items = [
			makeItem({ id: 'a', title: 'Alpha', poster: { src: 'alpha.jpg' } }),
			makeItem({ id: 'b', title: 'Beta', backdrop: { src: 'beta.jpg' } }),
		]

		const rail = toGenreRailData('Drama', 'poster', items)

		expect(rail.items).toHaveLength(2)
		expect(rail.items[0]).toMatchObject({ id: 'a', title: 'Alpha', variant: 'poster' })
		expect(rail.items[1]).toMatchObject({ id: 'b', title: 'Beta', variant: 'poster' })
	})

	it('uses poster image for poster variant', () => {
		const items = [makeItem({ poster: { src: 'poster.jpg' }, backdrop: { src: 'backdrop.jpg' } })]
		const rail = toGenreRailData('Sci-Fi', 'poster', items)

		expect(rail.items[0]?.imageUrl).toBe('poster.jpg')
	})

	it('uses backdrop image for backdrop variant', () => {
		const items = [makeItem({ poster: { src: 'poster.jpg' }, backdrop: { src: 'backdrop.jpg' } })]
		const rail = toGenreRailData('Sci-Fi', 'backdrop', items)

		expect(rail.items[0]?.imageUrl).toBe('backdrop.jpg')
	})

	it('handles empty items array', () => {
		const rail = toGenreRailData('Horror', 'poster', [])

		expect(rail.items).toEqual([])
		expect(rail.title).toBe('Horror')
	})
})
