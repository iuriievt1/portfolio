import { describe, expect, it } from 'vitest'
import type { MediaItem } from '../../../types/media'
import { toSearchResultsRail } from '../mappers'

const _makeItem = (overrides: Partial<MediaItem> = {}): MediaItem => ({
	id: 'test-1',
	kind: 'movie',
	title: 'Test Movie',
	poster: { src: 'https://img.test/poster.jpg' },
	backdrop: { src: 'https://img.test/backdrop.jpg' },
	...overrides,
})

describe('toSearchResultsRail — edge cases', () => {
	it('escapes double quotes in the query', () => {
		const rail = toSearchResultsRail([], 'action"movie')
		expect(rail.title).not.toBe('Results for "action"movie"')
	})

	it('handles empty query gracefully', () => {
		const rail = toSearchResultsRail([], '')
		expect(rail.title).not.toBe('Results for ""')
	})

	it('does not truncate very long query strings', () => {
		const longQuery = 'a'.repeat(1000)
		const rail = toSearchResultsRail([], longQuery)
		expect(rail.title).toBe(`Results for "${longQuery}"`)
	})

	it('returns valid rail structure with zero items', () => {
		const rail = toSearchResultsRail([], 'test')
		expect(rail.id).toBe('search-results')
		expect(rail.variant).toBe('poster')
		expect(rail.items).toEqual([])
		expect(rail.title).toBe('Results for "test"')
	})

	it('sanitizes HTML-like characters in query', () => {
		const rail = toSearchResultsRail([], '<script>alert("xss")</script>')
		expect(rail.title).not.toContain('<script>')
	})

	it('trims whitespace-only queries', () => {
		const rail = toSearchResultsRail([], '   ')
		expect(rail.title).not.toBe('Results for "   "')
	})
})
