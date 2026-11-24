import { describe, expect, it } from 'vitest'
import { tmdbImage } from '../tmdb'

describe('tmdbImage — edge cases', () => {
	it('returns undefined for null path', () => {
		expect(tmdbImage(null)).toBeUndefined()
	})

	it('returns undefined for undefined path', () => {
		expect(tmdbImage(undefined)).toBeUndefined()
	})

	it('returns undefined for empty string path', () => {
		expect(tmdbImage('')).toBeUndefined()
	})

	it('constructs correct URL with default size', () => {
		const result = tmdbImage('/abc.jpg')
		expect(result).toEqual({ src: 'https://image.tmdb.org/t/p/w780/abc.jpg' })
	})
})

/**
 * Year and badge extraction logic from tmdb.ts.
 * Mirrors the parseYear/parseBadges helpers used across all mapping functions.
 */

function extractYear(releaseDate?: string): number | undefined {
	if (!releaseDate?.trim()) return undefined
	const year = Number(releaseDate.slice(0, 4))
	if (Number.isNaN(year) || year < 1800) return undefined
	return year
}

function extractBadges(voteAverage?: number): Array<{ type: string; label: string }> {
	return voteAverage != null ? [{ type: 'rating', label: `TMDB ${voteAverage.toFixed(1)}` }] : []
}

describe('TMDB year extraction', () => {
	it('parses standard date correctly', () => {
		expect(extractYear('2024-08-15')).toBe(2024)
	})

	it('returns undefined for undefined release_date', () => {
		expect(extractYear(undefined)).toBeUndefined()
	})

	it('returns undefined for empty string release_date', () => {
		expect(extractYear('')).toBeUndefined()
	})

	it('returns undefined for whitespace-only release_date', () => {
		expect(extractYear(' ')).toBeUndefined()
	})

	it('returns undefined for short/invalid date "26"', () => {
		expect(extractYear('26')).toBeUndefined()
	})

	it('returns undefined (not NaN) for non-numeric date prefix', () => {
		const result = extractYear('abcd-01-01')
		expect(result).not.toBeNaN()
		expect(result).toBeUndefined()
	})
})

describe('TMDB badge extraction', () => {
	it('creates badge for normal vote_average', () => {
		const badges = extractBadges(7.5)
		expect(badges).toHaveLength(1)
		expect(badges[0]?.label).toBe('TMDB 7.5')
	})

	it('produces a badge for vote_average of 0', () => {
		const badges = extractBadges(0)
		expect(badges).toHaveLength(1)
		expect(badges[0]?.label).toBe('TMDB 0.0')
	})

	it('returns empty badges for undefined vote_average', () => {
		expect(extractBadges(undefined)).toEqual([])
	})
})
