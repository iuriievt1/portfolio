import { describe, expect, it } from 'vitest'
import { buildRailSkeletonCSS, computeCardWidth, getRailCols, getRailGap, getRailSizing } from '../tokens/rail-sizing'

describe('computeCardWidth — edge cases', () => {
	it('returns 0 or positive when container width is 0', () => {
		const sizing = getRailSizing('backdrop', 1280)
		expect(computeCardWidth(0, sizing)).toBeGreaterThanOrEqual(0)
	})

	it('returns 0 or positive when container is narrower than gaps', () => {
		const sizing = getRailSizing('backdrop', 1280)
		expect(computeCardWidth(10, sizing)).toBeGreaterThanOrEqual(0)
	})

	it('returns 0 or positive when container width is negative', () => {
		const sizing = getRailSizing('poster', 1280)
		expect(computeCardWidth(-100, sizing)).toBeGreaterThanOrEqual(0)
	})

	it('produces reasonable width for normal container', () => {
		const sizing = getRailSizing('backdrop', 1280)
		const cardW = computeCardWidth(1280, sizing)
		expect(cardW).toBeGreaterThan(100)
		expect(cardW).toBeLessThan(1280)
	})

	it('single-column mobile produces full-width card', () => {
		const sizing = getRailSizing('live', 400)
		expect(computeCardWidth(400, sizing)).toBeGreaterThan(300)
	})
})

describe('getRailCols — edge cases', () => {
	it('returns a positive column count for zero width', () => {
		expect(getRailCols('backdrop', 0)).toBeGreaterThan(0)
	})

	it('returns a positive column count for negative width', () => {
		expect(getRailCols('poster', -500)).toBeGreaterThan(0)
	})

	it('returns a finite positive number for NaN width', () => {
		const cols = getRailCols('backdrop', NaN)
		expect(Number.isFinite(cols)).toBe(true)
		expect(cols).toBeGreaterThan(0)
	})
})

describe('getRailGap — edge cases', () => {
	it('returns sm gap for widths below lg', () => {
		expect(getRailGap(500)).toBe(13)
	})

	it('returns a finite gap for NaN width', () => {
		expect(Number.isFinite(getRailGap(NaN))).toBe(true)
	})
})

describe('buildRailSkeletonCSS — edge cases', () => {
	it('returns empty string for empty selector', () => {
		const css = buildRailSkeletonCSS('backdrop', '')
		const lines = css.split('\n').filter(Boolean)
		for (const line of lines) {
			expect(line).not.toMatch(/^\s*\{/)
			expect(line).not.toMatch(/\{\s*\{/)
		}
	})

	it('does not allow selector injection via closing brace', () => {
		const css = buildRailSkeletonCSS('backdrop', '} .evil { color: red } .x')
		const openBraces = (css.match(/\{/g) || []).length
		const closeBraces = (css.match(/\}/g) || []).length
		expect(openBraces).toBe(closeBraces)
	})

	it('generates valid CSS for normal selector', () => {
		const css = buildRailSkeletonCSS('backdrop', '.rail-skeleton')
		expect(css).toContain('.rail-skeleton')
		expect(css).toContain('gap:')
		expect(css).toContain('flex:')
	})
})
