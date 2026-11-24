import { describe, expect, it } from 'vitest'
import type { MediaItem } from '../../../types/media'
import { toHeroItem, toRailItem } from '../mappers'

const makeItem = (overrides: Partial<MediaItem> = {}): MediaItem => ({
	id: 'test-1',
	kind: 'movie',
	title: 'Test Movie',
	poster: { src: 'https://img.test/poster.jpg' },
	backdrop: { src: 'https://img.test/backdrop.jpg' },
	...overrides,
})

describe('toRailItem — edge cases', () => {
	it('progress is 0 when durationSec is 0 (division by zero guard)', () => {
		const item = makeItem({ progress: { positionSec: 50, durationSec: 0 } })
		const result = toRailItem(item, 'continue')

		if (result.variant === 'continue') {
			expect(result.progress).toBe(0)
		}
	})

	it('progress clamps negative positionSec to 0', () => {
		const item = makeItem({ progress: { positionSec: -50, durationSec: 100 } })
		const result = toRailItem(item, 'continue')

		if (result.variant === 'continue') {
			expect(result.progress).toBe(0)
		}
	})

	it('progress is 0 when both positionSec and durationSec are 0', () => {
		const item = makeItem({ progress: { positionSec: 0, durationSec: 0 } })
		const result = toRailItem(item, 'continue')

		if (result.variant === 'continue') {
			expect(result.progress).not.toBeNaN()
			expect(result.progress).toBe(0)
		}
	})

	it('highlights metaLine does not contain string "undefined"', () => {
		const item = makeItem({
			sport: { variant: 'sport_highlight', label: 'Arsenal vs Chelsea' },
		})
		const result = toRailItem(item, 'highlights')

		if (result.variant === 'highlights') {
			expect(result.metaLine).not.toContain('undefined')
		}
	})

	it('highlights metaLine does not start with separator when timeLabel is missing', () => {
		const item = makeItem({
			sport: { variant: 'sport_highlight', label: 'Arsenal vs Chelsea' },
		})
		const result = toRailItem(item, 'highlights')

		if (result.variant === 'highlights') {
			expect(result.metaLine).not.toMatch(/^\s*·/)
		}
	})

	it('sponsored metaLine does not start with separator when timeLabel is missing', () => {
		const item = makeItem({
			sport: { variant: 'default_backdrop', label: 'NBA Finals' },
		})
		const result = toRailItem(item, 'sponsored')

		if (result.variant === 'sponsored') {
			expect(result.metaLine).not.toMatch(/^\s*·/)
		}
	})

	it('live variant handles undefined live data gracefully', () => {
		const item = makeItem({ live: undefined })
		const result = toRailItem(item, 'live')

		expect(result.variant).toBe('live')
		if (result.variant === 'live') {
			expect(result.live.channel).toBe('')
			expect(result.live.progress).toBe(0)
		}
	})
})

describe('toHeroItem — edge cases', () => {
	it('returns empty imageUrl when both backdrop and poster are undefined', () => {
		const item = makeItem({ backdrop: undefined, poster: undefined })
		expect(toHeroItem(item).imageUrl).toBe('')
	})

	it('returns undefined duration when durationSec is 0', () => {
		const item = makeItem({ durationSec: 0 })
		expect(toHeroItem(item).duration).toBeUndefined()
	})
})
