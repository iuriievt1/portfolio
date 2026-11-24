import type { RailData } from '@pkg/design-system'
import { describe, expect, it } from 'vitest'
import type { BrowseRailPage } from '../../../data/provider'
import { mergeBrowsePages } from '../pagination'

function page(items: string[], overrides: Partial<BrowseRailPage> = {}): BrowseRailPage {
	return {
		rail: { title: 'Movies', variant: 'poster', items: items.map((id) => ({ id })) } as RailData,
		hasMore: false,
		nextSkip: 0,
		...overrides,
	}
}

describe('mergeBrowsePages', () => {
	it('returns null when there are no pages', () => {
		expect(mergeBrowsePages([])).toBeNull()
	})

	it('returns null when every page is null/undefined', () => {
		expect(mergeBrowsePages([null, undefined])).toBeNull()
	})

	it('returns a single page unchanged', () => {
		const rail = mergeBrowsePages([page(['a', 'b'])])
		expect(rail?.items.map((i) => i.id)).toEqual(['a', 'b'])
	})

	it('concatenates items across pages in order', () => {
		const rail = mergeBrowsePages([page(['a', 'b']), page(['c', 'd']), page(['e'])])
		expect(rail?.items.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
	})

	it('dedupes items by id, keeping the first occurrence', () => {
		const rail = mergeBrowsePages([page(['a', 'b']), page(['b', 'c'])])
		expect(rail?.items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
	})

	it('keeps the first page metadata', () => {
		const rail = mergeBrowsePages([
			page(['a'], { rail: { title: 'First', variant: 'poster', items: [{ id: 'a' }] } as RailData }),
			page(['b'], { rail: { title: 'Second', variant: 'backdrop', items: [{ id: 'b' }] } as RailData }),
		])
		expect(rail?.title).toBe('First')
		expect(rail?.variant).toBe('poster')
	})

	it('skips null pages while merging the rest', () => {
		const rail = mergeBrowsePages([page(['a']), null, page(['b'])])
		expect(rail?.items.map((i) => i.id)).toEqual(['a', 'b'])
	})
})
