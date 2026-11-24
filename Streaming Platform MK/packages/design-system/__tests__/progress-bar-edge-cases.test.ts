/**
 * Tests for ProgressBar width computation.
 * Formula: `${clamp(value, 0, 1) * 100}%`
 */

import { clamp } from '@pkg/utils'
import { describe, expect, it } from 'vitest'

function computeProgressWidth(value: number): string {
	return `${clamp(value, 0, 1) * 100}%`
}

describe('ProgressBar width computation', () => {
	it('produces 0% when value is NaN', () => {
		expect(computeProgressWidth(NaN)).toBe('0%')
	})

	it('clamps negative values to 0%', () => {
		expect(computeProgressWidth(-0.5)).toBe('0%')
	})

	it('clamps values above 1 to 100%', () => {
		expect(computeProgressWidth(1.5)).toBe('100%')
	})

	it('handles normal values correctly', () => {
		expect(computeProgressWidth(0.5)).toBe('50%')
	})

	it('handles exact boundaries', () => {
		expect(computeProgressWidth(0)).toBe('0%')
		expect(computeProgressWidth(1)).toBe('100%')
	})

	it('produces 100% for Infinity', () => {
		expect(computeProgressWidth(Infinity)).toBe('100%')
	})

	it('produces 0% for undefined coerced to number', () => {
		expect(computeProgressWidth(undefined as unknown as number)).toBe('0%')
	})
})
