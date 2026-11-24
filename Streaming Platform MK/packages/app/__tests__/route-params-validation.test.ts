import { validateRouteParam } from '@pkg/utils'
import { describe, expect, it } from 'vitest'

describe('validateRouteParam', () => {
	it('returns null for undefined input', () => {
		expect(validateRouteParam(undefined)).toBeNull()
	})

	it('extracts first element from string array', () => {
		expect(validateRouteParam(['abc', 'def'])).toBe('abc')
	})

	it('returns null for empty string', () => {
		expect(validateRouteParam('')).toBeNull()
	})

	it('returns null for whitespace-only string', () => {
		expect(validateRouteParam('   ')).toBeNull()
	})

	it('returns null for empty array', () => {
		expect(validateRouteParam([])).toBeNull()
	})

	it('returns null when array first element is empty string', () => {
		expect(validateRouteParam(['', 'valid'])).toBeNull()
	})

	it('returns the string unchanged for a valid id', () => {
		expect(validateRouteParam('abc-123')).toBe('abc-123')
	})

	it('returns the string for a numeric id', () => {
		expect(validateRouteParam('42')).toBe('42')
	})
})
