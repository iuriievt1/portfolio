import type { RailData, RailItemData } from '@pkg/design-system'
import { describe, expect, it } from 'vitest'
import { applyRailDisplayLimit, RAIL_MAX_CARDS } from '../rail-display'

const items = (count: number): RailItemData[] =>
	Array.from({ length: count }, (_, i) => ({
		variant: 'backdrop' as const,
		id: `item-${i}`,
		title: `Item ${i}`,
		imageUrl: `https://cdn.test/${i}.jpg`,
		href: `/title?id=item-${i}`,
	}))

const rail = (count: number, viewAll = true): RailData => ({
	id: 'FEED_1',
	title: 'Trending',
	variant: 'backdrop',
	items: items(count),
	...(viewAll ? { viewAllHref: '/browse?feed=FEED_1', viewAllLabel: 'View all' } : {}),
})

describe('applyRailDisplayLimit', () => {
	it('caps the rail at 20 cards', () => {
		expect(RAIL_MAX_CARDS).toBe(20)
		expect(applyRailDisplayLimit(rail(25)).items).toHaveLength(20)
	})

	it('keeps the View All target when the feed has more than 20 items', () => {
		const result = applyRailDisplayLimit(rail(21))
		expect(result.viewAllHref).toBe('/browse?feed=FEED_1')
		expect(result.viewAllLabel).toBe('View all')
	})

	it('drops the View All target when every item is already on the rail', () => {
		const result = applyRailDisplayLimit(rail(12))
		expect(result.items).toHaveLength(12)
		expect(result.viewAllHref).toBeUndefined()
		expect(result.viewAllLabel).toBeUndefined()
	})

	it('drops the View All target at exactly 20 items (boundary)', () => {
		const result = applyRailDisplayLimit(rail(20))
		expect(result.items).toHaveLength(20)
		expect(result.viewAllHref).toBeUndefined()
	})

	it('caps rails that have no View All target at all', () => {
		const result = applyRailDisplayLimit(rail(30, false))
		expect(result.items).toHaveLength(20)
		expect(result.viewAllHref).toBeUndefined()
	})

	it('preserves item order and the rest of the rail', () => {
		const result = applyRailDisplayLimit(rail(25))
		expect(result.id).toBe('FEED_1')
		expect(result.title).toBe('Trending')
		expect(result.variant).toBe('backdrop')
		expect(result.items[0]?.id).toBe('item-0')
		expect(result.items.at(-1)?.id).toBe('item-19')
	})

	it('leaves an empty rail untouched', () => {
		const result = applyRailDisplayLimit(rail(0))
		expect(result.items).toHaveLength(0)
		expect(result.viewAllHref).toBeUndefined()
	})
})
