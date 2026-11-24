import { describe, expect, it } from 'vitest'
import { formatEventStartLabel } from '../format-event-start'

describe('formatEventStartLabel', () => {
	it('formats an ISO start time as "MON D, H:MMam/pm"', () => {
		// Built from local components so the round-trip is timezone-independent.
		const iso = new Date(2026, 2, 11, 15, 30, 0).toISOString()
		expect(formatEventStartLabel(iso)).toBe('MAR 11, 3:30pm')
	})

	it('uses lowercase am with no space', () => {
		const iso = new Date(2026, 0, 5, 9, 5, 0).toISOString()
		expect(formatEventStartLabel(iso)).toBe('JAN 5, 9:05am')
	})

	it('returns null for missing input', () => {
		expect(formatEventStartLabel(undefined)).toBeNull()
		expect(formatEventStartLabel(null)).toBeNull()
		expect(formatEventStartLabel('')).toBeNull()
	})

	it('returns null for an invalid date', () => {
		expect(formatEventStartLabel('not-a-date')).toBeNull()
	})
})
