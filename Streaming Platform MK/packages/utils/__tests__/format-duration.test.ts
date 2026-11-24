import { describe, expect, it } from 'vitest'
import { formatDuration } from '../format-duration'

describe('formatDuration', () => {
	it('formats 0 seconds as 0m', () => {
		expect(formatDuration(0)).toBe('0m')
	})

	it('formats seconds under a minute', () => {
		expect(formatDuration(45)).toBe('1m')
	})

	it('formats exact minutes', () => {
		expect(formatDuration(300)).toBe('5m')
	})

	it('formats exact hours', () => {
		expect(formatDuration(7200)).toBe('2h')
	})

	it('formats hours and minutes', () => {
		expect(formatDuration(5400)).toBe('1h 30m')
	})

	it('rounds minutes', () => {
		expect(formatDuration(5430)).toBe('1h 31m')
	})
})
