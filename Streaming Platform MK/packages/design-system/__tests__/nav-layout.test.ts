import { describe, expect, it } from 'vitest'
import { NAV_FIT_SLACK, shouldCollapseNav } from '../components/ui/AppBar/nav-layout'

const base = { available: 540, logoWidth: 60, navWidth: 300, rightWidth: 90, gap: 30 }

describe('shouldCollapseNav', () => {
	it('keeps the inline nav when the row has room to spare', () => {
		expect(shouldCollapseNav({ ...base, available: 1200 })).toBe(false)
	})

	it('collapses when the parts add up past the row', () => {
		// 60 + 30 + 300 + 30 + 90 = 510, plus slack, against 480
		expect(shouldCollapseNav({ ...base, available: 480 })).toBe(true)
	})

	it('counts the gap on both sides of the nav', () => {
		// Without both gaps 60 + 300 + 90 = 450 would fit in 500; with them it is 510.
		expect(shouldCollapseNav({ ...base, available: 500 })).toBe(true)
	})

	it('collapses when longer labels widen the nav at an unchanged width', () => {
		expect(shouldCollapseNav({ ...base, navWidth: 260 })).toBe(false)
		expect(shouldCollapseNav({ ...base, navWidth: 400 })).toBe(true)
	})

	it('leaves slack so a sub-pixel rounding does not collapse a nav that just fits', () => {
		expect(shouldCollapseNav({ ...base, available: 510 + NAV_FIT_SLACK })).toBe(false)
	})

	it('keeps the nav while the row has not been measured yet', () => {
		expect(shouldCollapseNav({ ...base, available: 0 })).toBe(false)
	})

	it('keeps the nav when there are no items to measure', () => {
		expect(shouldCollapseNav({ ...base, available: 100, navWidth: 0 })).toBe(false)
	})
})
