import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTrendingMovies, searchMovies, tmdbImage } from '../tmdb'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

afterEach(() => {
	mockFetch.mockReset()
})

describe('tmdbImage', () => {
	it('returns image ref for valid path', () => {
		expect(tmdbImage('/abc.jpg')).toEqual({ src: 'https://image.tmdb.org/t/p/w780/abc.jpg' })
	})

	it('returns image ref with custom size', () => {
		expect(tmdbImage('/abc.jpg', 'w500')).toEqual({ src: 'https://image.tmdb.org/t/p/w500/abc.jpg' })
	})

	it('returns undefined for null path', () => {
		expect(tmdbImage(null)).toBeUndefined()
	})

	it('returns undefined for undefined path', () => {
		expect(tmdbImage(undefined)).toBeUndefined()
	})
})

describe('getTrendingMovies', () => {
	it('returns array of MediaItems on success', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			text: () =>
				Promise.resolve(
					JSON.stringify({
						results: [
							{
								id: 1,
								title: 'Test Movie',
								release_date: '2026-01-15',
								overview: 'A great movie',
								poster_path: '/poster.jpg',
								backdrop_path: '/backdrop.jpg',
								vote_average: 8.5,
							},
						],
					}),
				),
		})

		const movies = await getTrendingMovies()

		expect(movies).toHaveLength(1)
		expect(movies[0]).toMatchObject({
			id: 'tmdbm_1',
			kind: 'movie',
			title: 'Test Movie',
			year: 2026,
			synopsis: 'A great movie',
		})
		expect(movies[0]?.poster?.src).toContain('/poster.jpg')
		expect(movies[0]?.backdrop?.src).toContain('/backdrop.jpg')
	})

	it('returns empty array on failure with console.error', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		mockFetch.mockRejectedValueOnce(new Error('network error'))

		const movies = await getTrendingMovies()

		expect(movies).toEqual([])
		expect(consoleSpy).toHaveBeenCalledWith('[TMDB] getTrendingMovies failed:', expect.any(Error))

		consoleSpy.mockRestore()
	})

	it('returns empty array when API returns non-OK status', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: () => Promise.resolve(JSON.stringify({ status_message: 'Unauthorized' })),
		})

		const movies = await getTrendingMovies()

		expect(movies).toEqual([])
		expect(consoleSpy).toHaveBeenCalled()

		consoleSpy.mockRestore()
	})
})

describe('searchMovies', () => {
	it('returns results for valid query', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			text: () =>
				Promise.resolve(
					JSON.stringify({
						results: [
							{
								id: 42,
								title: 'Found Movie',
								poster_path: '/found.jpg',
								vote_average: 7.2,
							},
							{
								id: 43,
								title: 'Another Movie',
								poster_path: null,
								backdrop_path: '/back.jpg',
							},
						],
					}),
				),
		})

		const results = await searchMovies('test query')

		expect(results).toHaveLength(2)
		expect(results[0]?.title).toBe('Found Movie')
		expect(results[1]?.title).toBe('Another Movie')
	})

	it('returns empty array on failure', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		mockFetch.mockRejectedValueOnce(new Error('network error'))

		const results = await searchMovies('test')

		expect(results).toEqual([])

		consoleSpy.mockRestore()
	})

	it('handles movies without release_date', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			text: () =>
				Promise.resolve(
					JSON.stringify({
						results: [{ id: 99, title: 'No Date Movie' }],
					}),
				),
		})

		const results = await searchMovies('no date')

		expect(results[0]?.year).toBeUndefined()
	})
})
