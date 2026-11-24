import { describe, expect, it } from 'vitest'
import { type AudioFeedTrack, groupAudioFeeds, isMultiviewAudio, spotlightTileSources } from '../multiview-feeds'

// Mirrors the real `mv-test` master manifest: 4 feeds × 2 languages.
const MOSAIC_TRACKS: AudioFeedTrack[] = [
	{ id: '200', label: 'eng_A', lang: 'en', feedKey: 'A' },
	{ id: '201', label: 'spa_A', lang: 'es', feedKey: 'A' },
	{ id: '202', label: 'eng_B', lang: 'en', feedKey: 'B' },
	{ id: '203', label: 'spa_B', lang: 'es', feedKey: 'B' },
	{ id: '204', label: 'eng_C', lang: 'en', feedKey: 'C' },
	{ id: '205', label: 'spa_C', lang: 'es', feedKey: 'C' },
	{ id: '206', label: 'eng_D', lang: 'en', feedKey: 'D' },
	{ id: '207', label: 'spa_D', lang: 'es', feedKey: 'D' },
]

describe('groupAudioFeeds', () => {
	it('groups the mosaic into 4 ordered feeds mapped to tile positions', () => {
		const feeds = groupAudioFeeds(MOSAIC_TRACKS)
		expect(feeds.map((f) => f.key)).toEqual(['A', 'B', 'C', 'D'])
		expect(feeds.map((f) => f.index)).toEqual([0, 1, 2, 3])
		expect(feeds.map((f) => f.label)).toEqual(['Feed A', 'Feed B', 'Feed C', 'Feed D'])
	})

	// MK is adding 2-up and 3-up mosaics; the feed count comes from the stream, nothing is fixed at 4.
	it('groups a 2-up mosaic into two feeds', () => {
		const feeds = groupAudioFeeds([
			{ id: '1', label: 'eng_A', lang: 'en', feedKey: 'A' },
			{ id: '2', label: 'spa_A', lang: 'es', feedKey: 'A' },
			{ id: '3', label: 'eng_B', lang: 'en', feedKey: 'B' },
		])

		expect(feeds.map((feed) => [feed.key, feed.index])).toEqual([
			['A', 0],
			['B', 1],
		])
	})

	it('groups a 3-up mosaic into three feeds', () => {
		const feeds = groupAudioFeeds([
			{ id: '1', label: 'eng_C', lang: 'en', feedKey: 'C' },
			{ id: '2', label: 'eng_A', lang: 'en', feedKey: 'A' },
			{ id: '3', label: 'eng_B', lang: 'en', feedKey: 'B' },
		])

		expect(feeds.map((feed) => [feed.key, feed.index])).toEqual([
			['A', 0],
			['B', 1],
			['C', 2],
		])
	})

	it('keeps both languages per feed and prefers English as default', () => {
		const feedA = groupAudioFeeds(MOSAIC_TRACKS)[0]
		expect(feedA.tracks).toHaveLength(2)
		expect(feedA.defaultAudioId).toBe('200') // eng_A, not spa_A
	})

	it('falls back to the first track when no English variant exists', () => {
		const feed = groupAudioFeeds([
			{ id: 'x', label: 'spa_A', lang: 'es', feedKey: 'A' },
			{ id: 'y', label: 'fra_B', lang: 'fr', feedKey: 'B' },
		])
		expect(feed.map((f) => f.defaultAudioId)).toEqual(['x', 'y'])
	})

	it('returns [] for a normal stream with only language variants', () => {
		const tracks: AudioFeedTrack[] = [
			{ id: '1', label: 'English', lang: 'en' },
			{ id: '2', label: 'French', lang: 'fr' },
		]
		expect(groupAudioFeeds(tracks)).toEqual([])
	})

	it('returns [] when fewer than 2 feed keys are present', () => {
		expect(groupAudioFeeds([{ id: '1', label: 'eng_A', lang: 'en', feedKey: 'A' }])).toEqual([])
	})
})

describe('isMultiviewAudio', () => {
	it('is true for the mosaic stream', () => {
		expect(isMultiviewAudio(MOSAIC_TRACKS)).toBe(true)
	})

	it('is false for a normal multi-language stream', () => {
		expect(
			isMultiviewAudio([
				{ id: '1', label: 'English', lang: 'en' },
				{ id: '2', label: 'Spanish', lang: 'es' },
			]),
		).toBe(false)
	})
})

describe('spotlightTileSources', () => {
	const canonical = ['A', 'B', 'C']

	// The base variant composites its sources in canonical order.
	it('leaves the base variant in canonical order', () => {
		expect(spotlightTileSources(canonical, 'A')).toEqual(['A', 'B', 'C'])
	})

	// Confirmed against the live streams: `-b` enlarges source B and shows A then C beside it.
	it('puts the loaded variant own source in the big tile, the rest in canonical order', () => {
		expect(spotlightTileSources(canonical, 'B')).toEqual(['B', 'A', 'C'])
		expect(spotlightTileSources(canonical, 'C')).toEqual(['C', 'A', 'B'])
	})

	it('keeps every source, whichever one is enlarged', () => {
		for (const loaded of canonical) {
			expect([...spotlightTileSources(canonical, loaded)].sort()).toEqual(canonical)
		}
	})

	it('falls back to canonical order for a source it does not know', () => {
		expect(spotlightTileSources(canonical, 'Z')).toEqual(canonical)
		expect(spotlightTileSources(canonical, '')).toEqual(canonical)
	})
})
