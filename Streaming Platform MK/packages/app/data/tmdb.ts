// TODO: @env is a Metro-only alias — importing this file in Vitest without mocking the parent module will crash. Keep test boundary at home.ts mock level.
import { TMDB_READ_TOKEN } from '@env'
import type { ImageRef, MediaItem } from '../types/media'

const TMDB = 'https://api.themoviedb.org/3'

const TOKEN = TMDB_READ_TOKEN

let tokenValidated = false

function validateToken() {
	if (tokenValidated) return
	tokenValidated = true

	if (!TOKEN) {
		throw new Error('TMDB_READ_TOKEN is missing (set it in .env and restart metro).')
	}

	if (TOKEN.includes('import') || TOKEN.includes('\n')) {
		throw new Error('TMDB_READ_TOKEN looks corrupted (contains code/newline). Check .env formatting.')
	}
}

type TmdbTvDetails = {
	id: number
	name: string
	original_name?: string
	overview?: string
	first_air_date?: string
	poster_path?: string | null
	backdrop_path?: string | null
	vote_average?: number

	next_episode_to_air?: {
		id: number
		name: string
		season_number: number
		episode_number: number
		air_date?: string
	} | null

	last_episode_to_air?: {
		id: number
		name: string
		season_number: number
		episode_number: number
		air_date?: string
	} | null
}

type TmdbSeason = {
	id: number
	name: string
	season_number: number
	episodes: Array<{
		id: number
		name: string
		overview?: string
		still_path?: string | null
		episode_number: number
		season_number: number
		air_date?: string
	}>
}

export async function tvSeasonRaw(tvId: number, season: number): Promise<TmdbSeason> {
	return tmdbFetch(`/tv/${tvId}/season/${season}`, { language: 'en-US' })
}

type TmdbEpisode = {
	id: number
	name: string
	still_path?: string | null
	episode_number: number
	season_number: number
}

type TmdbMovieResult = {
	id: number
	title: string
	original_title?: string
	release_date?: string
	overview?: string
	poster_path?: string | null
	backdrop_path?: string | null
	vote_average?: number
}

type TmdbTvResult = {
	id: number
	name: string
	original_name?: string
	first_air_date?: string
	overview?: string
	poster_path?: string | null
	backdrop_path?: string | null
	vote_average?: number
}

type TmdbPageResponse<T> = { results: T[] }

export async function tvDetailsRaw(tvId: number): Promise<TmdbTvDetails> {
	return tmdbFetch(`/tv/${tvId}`, { language: 'en-US' })
}

export async function tvEpisodeRaw(tvId: number, season: number, episode: number): Promise<TmdbEpisode> {
	return tmdbFetch(`/tv/${tvId}/season/${season}/episode/${episode}`, { language: 'en-US' })
}

export function tmdbImage(
	path: string | null | undefined,
	size: 'w500' | 'w780' | 'w1280' = 'w780',
): ImageRef | undefined {
	if (!path) return undefined
	return { src: `https://image.tmdb.org/t/p/${size}${path}` }
}

async function tmdbFetch<T = unknown>(path: string, qs: Record<string, string | number | undefined> = {}): Promise<T> {
	validateToken()

	// remove trailing slash (except root)
	const cleanPath = path !== '/' ? path.replace(/\/+$/, '') : path

	const url = `${TMDB}${cleanPath}${buildQuery(qs)}`

	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
	})

	const text = await res.text()
	let json: T
	try {
		json = JSON.parse(text) as T
	} catch (err) {
		console.error('[TMDB] Invalid JSON response', { url, status: res.status, body: text.slice(0, 200), err })
		throw new Error(`TMDB: invalid JSON response from ${url}`, { cause: err })
	}
	if (!res.ok) throw new Error(`TMDB error ${res.status}: ${JSON.stringify(json)}`)
	return json
}

// RN friendly query builder (no URL/URLSearchParams)
function buildQuery(qs: Record<string, string | number | undefined>) {
	const entries = Object.entries(qs).filter(([, v]) => v !== undefined)
	if (!entries.length) return ''
	const q = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
	return `?${q}`
}

const img = (path: string | null | undefined, size = 'w500') =>
	path ? { src: `https://image.tmdb.org/t/p/${size}${path}` } : undefined

function parseYear(dateStr: string | undefined): number | undefined {
	if (!dateStr || !dateStr.trim()) return undefined
	const y = Number(dateStr.slice(0, 4))
	return !Number.isNaN(y) && y >= 1800 ? y : undefined
}

function parseBadges(voteAverage: number | undefined): Array<{ type: 'rating'; label: string }> {
	return voteAverage != null ? [{ type: 'rating', label: `TMDB ${voteAverage.toFixed(1)}` }] : []
}

// ── Discovery/trending ──────────────────────────────────────────

export async function getTrendingMovies(): Promise<MediaItem[]> {
	try {
		const data = await tmdbFetch<TmdbPageResponse<TmdbMovieResult>>('/trending/movie/week')

		return data.results.map(
			(m): MediaItem => ({
				id: `tmdbm_${m.id}`,
				kind: 'movie',
				title: m.title,
				originalTitle: m.original_title,
				year: parseYear(m.release_date),
				synopsis: m.overview,
				poster: img(m.poster_path, 'w500'),
				backdrop: img(m.backdrop_path, 'w780'),
				badges: parseBadges(m.vote_average),
				genres: [],
				durationSec: undefined,
				playback: {
					playable: true,
					protocol: 'hls',
					streamUrl: 'https://example.invalid/stream.m3u8',
				},
				meta: { imdb: m.vote_average },
			}),
		)
	} catch (error) {
		// biome-ignore lint/suspicious/noConsole: error logging for data layer failures
		console.error('[TMDB] getTrendingMovies failed:', error)
		return []
	}
}

export async function discoverMovies(params: Record<string, string | number | undefined>): Promise<MediaItem[]> {
	try {
		const data = await tmdbFetch<TmdbPageResponse<TmdbMovieResult>>('/discover/movie', { language: 'en-US', ...params })
		return data.results.map(
			(m): MediaItem => ({
				id: `tmdbm_${m.id}`,
				kind: 'movie',
				title: m.title,
				originalTitle: m.original_title,
				year: parseYear(m.release_date),
				synopsis: m.overview,
				poster: img(m.poster_path, 'w500'),
				backdrop: img(m.backdrop_path, 'w780'),
				badges: parseBadges(m.vote_average),
				genres: [],
				playback: { playable: true, protocol: 'hls', streamUrl: 'https://example.invalid/stream.m3u8' },
				meta: { imdb: m.vote_average },
			}),
		)
	} catch (error) {
		// biome-ignore lint/suspicious/noConsole: error logging for data layer failures
		console.error('[TMDB] discoverMovies failed:', error)
		return []
	}
}

export async function trendingTvWeek(): Promise<MediaItem[]> {
	try {
		const data = await tmdbFetch<TmdbPageResponse<TmdbTvResult>>('/trending/tv/week', { language: 'en-US', page: 1 })
		return data.results.map(
			(t): MediaItem => ({
				id: `tmdbt_${t.id}`,
				kind: 'series',
				title: t.name,
				originalTitle: t.original_name,
				year: parseYear(t.first_air_date),
				synopsis: t.overview,
				poster: img(t.poster_path, 'w500'),
				backdrop: img(t.backdrop_path, 'w780'),
				badges: parseBadges(t.vote_average),
				genres: [],
				playback: { playable: true, protocol: 'hls', streamUrl: 'https://example.invalid/stream.m3u8' },
				meta: { imdb: t.vote_average },
			}),
		)
	} catch (error) {
		// biome-ignore lint/suspicious/noConsole: error logging for data layer failures
		console.error('[TMDB] trendingTvWeek failed:', error)
		return []
	}
}

export async function searchMovies(query: string, page = 1): Promise<MediaItem[]> {
	try {
		const data = await tmdbFetch<TmdbPageResponse<TmdbMovieResult>>('/search/movie', {
			language: 'en-US',
			query,
			page,
			include_adult: 'false',
		})
		return data.results.map(
			(m): MediaItem => ({
				id: `tmdbm_${m.id}`,
				kind: 'movie',
				title: m.title,
				originalTitle: m.original_title,
				year: parseYear(m.release_date),
				synopsis: m.overview,
				poster: img(m.poster_path, 'w500'),
				backdrop: img(m.backdrop_path, 'w780'),
				badges: parseBadges(m.vote_average),
				genres: [],
				playback: { playable: true, protocol: 'hls', streamUrl: 'https://example.invalid/stream.m3u8' },
				meta: { imdb: m.vote_average },
			}),
		)
	} catch (error) {
		// biome-ignore lint/suspicious/noConsole: error logging for data layer failures
		console.error('[TMDB] searchMovies failed:', error)
		return []
	}
}

export async function searchTv(query: string, page = 1): Promise<MediaItem[]> {
	try {
		const data = await tmdbFetch<TmdbPageResponse<TmdbTvResult>>('/search/tv', { language: 'en-US', query, page })
		return data.results.map(
			(t): MediaItem => ({
				id: `tmdbt_${t.id}`,
				kind: 'series',
				title: t.name,
				originalTitle: t.original_name,
				year: parseYear(t.first_air_date),
				synopsis: t.overview,
				poster: img(t.poster_path, 'w500'),
				backdrop: img(t.backdrop_path, 'w780'),
				badges: parseBadges(t.vote_average),
				genres: [],
				playback: { playable: true, protocol: 'hls', streamUrl: 'https://example.invalid/stream.m3u8' },
				meta: { imdb: t.vote_average },
			}),
		)
	} catch (error) {
		// biome-ignore lint/suspicious/noConsole: error logging for data layer failures
		console.error('[TMDB] searchTv failed:', error)
		return []
	}
}
