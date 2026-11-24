import { describe, expect, it } from 'vitest'
import { clamp, toPercent } from '../clamp'

describe('clamp — edge cases', () => {
	it('returns min when value is NaN', () => {
		expect(clamp(NaN, 0, 1)).toBe(0)
	})

	it('clamps Infinity to max', () => {
		expect(clamp(Infinity, 0, 1)).toBe(1)
	})

	it('clamps -Infinity to min', () => {
		expect(clamp(-Infinity, 0, 1)).toBe(0)
	})

	it('returns a finite number when min is NaN', () => {
		expect(Number.isFinite(clamp(0.5, NaN, 1))).toBe(true)
	})

	it('returns a finite number when max is NaN', () => {
		expect(Number.isFinite(clamp(0.5, 0, NaN))).toBe(true)
	})

	it('throws when min > max (inverted range)', () => {
		expect(() => clamp(0.5, 1, 0)).toThrow()
	})
})

describe('toPercent — edge cases', () => {
	it('returns 0 when given NaN', () => {
		expect(toPercent(NaN)).toBe(0)
	})
})
