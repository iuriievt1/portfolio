import { describe, expect, it } from 'vitest'
import { clamp, toPercent } from '../clamp'

describe('clamp', () => {
	it('returns min when value is below range', () => {
		expect(clamp(-5, 0, 10)).toBe(0)
	})

	it('returns max when value is above range', () => {
		expect(clamp(15, 0, 10)).toBe(10)
	})

	it('returns value when within range', () => {
		expect(clamp(5, 0, 10)).toBe(5)
	})
})

describe('toPercent', () => {
	it('converts fraction to percentage', () => {
		expect(toPercent(0.5)).toBe(50)
	})

	it('clamps negative to 0', () => {
		expect(toPercent(-0.5)).toBe(0)
	})

	it('clamps >1 to 100', () => {
		expect(toPercent(1.5)).toBe(100)
	})
})
