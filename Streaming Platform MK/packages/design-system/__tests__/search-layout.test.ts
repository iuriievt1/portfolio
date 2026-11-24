import { describe, expect, it } from 'vitest'
import { resolveSearchLayout, SEARCH_PILL_MIN_WIDTH } from '../components/ui/AppBar/search-layout'

describe('resolveSearchLayout', () => {
	it('uses the preferred width when the bar has room to spare', () => {
		expect(resolveSearchLayout({ freeWithNav: 400, navWidth: 200, preferred: 280 })).toEqual({
			pillWidth: 280,
			hideNav: false,
		})
	})

	it('shrinks the pill to the free space instead of overlapping the nav', () => {
		expect(resolveSearchLayout({ freeWithNav: 210, navWidth: 200, preferred: 240 })).toEqual({
			pillWidth: 210,
			hideNav: false,
		})
	})

	it('keeps the nav when the free space is exactly the minimum', () => {
		expect(resolveSearchLayout({ freeWithNav: SEARCH_PILL_MIN_WIDTH, navWidth: 200, preferred: 240 })).toEqual({
			pillWidth: SEARCH_PILL_MIN_WIDTH,
			hideNav: false,
		})
	})

	// iPhone SE landscape (667px) with five nav items — the case reported in #78.
	it('hides the nav once the pill can no longer stay usable beside it', () => {
		expect(resolveSearchLayout({ freeWithNav: 90, navWidth: 350, preferred: 240 })).toEqual({
			pillWidth: 240,
			hideNav: true,
		})
	})

	it('caps the pill at the space freed by the nav', () => {
		expect(resolveSearchLayout({ freeWithNav: 20, navWidth: 180, preferred: 240 })).toEqual({
			pillWidth: 200,
			hideNav: true,
		})
	})

	it('never renders an unusably narrow pill', () => {
		expect(resolveSearchLayout({ freeWithNav: 10, navWidth: 30, preferred: 240 })).toEqual({
			pillWidth: SEARCH_PILL_MIN_WIDTH,
			hideNav: true,
		})
	})

	it('rounds fractional measurements down so the pill never overshoots', () => {
		expect(resolveSearchLayout({ freeWithNav: 210.8, navWidth: 200, preferred: 240 })).toEqual({
			pillWidth: 210,
			hideNav: false,
		})
	})
})
