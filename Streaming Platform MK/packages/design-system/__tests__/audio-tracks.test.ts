import { describe, expect, it } from 'vitest'
import {
	audioTrackMenuLabel,
	formatAudioTrackLabel,
	parseFeedKey,
	resolveSelectedAudioId,
	spansMultipleFeeds,
} from '../components/features/VideoPlayer/utils/audio-tracks'

describe('formatAudioTrackLabel', () => {
	it('replaces the SDK placeholder emitted for muxed audio', () => {
		expect(formatAudioTrackLabel({ label: 'und', lang: '' })).toBe('English')
		expect(formatAudioTrackLabel({ label: 'und', lang: 'und' })).toBe('English')
	})

	it('uses the manifest language when the label is technical', () => {
		expect(formatAudioTrackLabel({ label: 'und', lang: 'es' })).toBe('Spanish')
		expect(formatAudioTrackLabel({ label: 'audio_1', lang: 'fr' })).toBe('French')
		expect(formatAudioTrackLabel({ label: '', lang: 'de' })).toBe('German')
	})

	it('formats bare language-code labels', () => {
		expect(formatAudioTrackLabel({ label: 'en', lang: 'en' })).toBe('English')
		expect(formatAudioTrackLabel({ label: 'eng', lang: 'eng' })).toBe('English')
	})

	it('maps three-letter codes the manifest uses as the label', () => {
		expect(formatAudioTrackLabel({ label: 'FRA', lang: '' })).toBe('French')
		expect(formatAudioTrackLabel({ label: 'DEU', lang: '' })).toBe('German')
		expect(formatAudioTrackLabel({ label: 'ger', lang: 'und' })).toBe('German')
		expect(formatAudioTrackLabel({ label: 'pt-BR', lang: '' })).toBe('Brazilian Portuguese')
	})

	it('shows the raw tag when the code maps to nothing', () => {
		expect(formatAudioTrackLabel({ label: 'qaa', lang: '' })).toBe('qaa')
		expect(formatAudioTrackLabel({ label: 'ZZ', lang: 'ZZ' })).toBe('ZZ')
	})

	it('keeps human-readable labels', () => {
		expect(formatAudioTrackLabel({ label: 'English (Commentary)', lang: 'en' })).toBe('English (Commentary)')
	})

	// Multiview mosaic labels used to reach the menu raw, as `eng_A` / `spa_B`.
	it('resolves the language out of a multiview feed label', () => {
		expect(formatAudioTrackLabel({ label: 'eng_A', lang: 'eng' })).toBe('English')
		expect(formatAudioTrackLabel({ label: 'spa_D', lang: '' })).toBe('Spanish')
	})
})

describe('parseFeedKey', () => {
	it('reads the feed suffix, uppercased, for either separator', () => {
		expect(parseFeedKey('eng_A')).toBe('A')
		expect(parseFeedKey('eng-b')).toBe('B')
		expect(parseFeedKey('es-mx_C')).toBe('C')
	})

	it('returns null for a label that is not a feed id', () => {
		expect(parseFeedKey('English')).toBeNull()
		expect(parseFeedKey('English (Commentary)')).toBeNull()
		expect(parseFeedKey('eng')).toBeNull()
		expect(parseFeedKey(undefined)).toBeNull()
	})
})

describe('audio menu labels', () => {
	const mosaic = [
		{ label: 'English', feedKey: 'A' },
		{ label: 'Spanish', feedKey: 'A' },
		{ label: 'English', feedKey: 'B' },
	]

	it('names the feed only when the list spans more than one', () => {
		expect(spansMultipleFeeds(mosaic)).toBe(true)
		expect(audioTrackMenuLabel(mosaic[0], true)).toBe('English (Feed A)')
	})

	// Zoomed into one feed, every row shares it — repeating it would be noise.
	it('drops the feed once the list is filtered to a single one', () => {
		const single = mosaic.filter((t) => t.feedKey === 'A')
		expect(spansMultipleFeeds(single)).toBe(false)
		expect(audioTrackMenuLabel(single[0], false)).toBe('English')
	})

	it('leaves a non-multiview track alone', () => {
		expect(spansMultipleFeeds([{ label: 'English' }, { label: 'French' }])).toBe(false)
		expect(audioTrackMenuLabel({ label: 'French' }, true)).toBe('French')
	})
})

describe('resolveSelectedAudioId', () => {
	it('keeps the SDK selection when it is in the list', () => {
		expect(resolveSelectedAudioId([{ id: 'a' }, { id: 'b' }], 'b')).toBe('b')
	})

	it('falls back to the first track when the SDK reports no current track', () => {
		expect(resolveSelectedAudioId([{ id: 'a' }, { id: 'b' }], null)).toBe('a')
	})

	it('falls back to the first track when the selection is stale', () => {
		expect(resolveSelectedAudioId([{ id: 'audio-1' }], 'audio-0')).toBe('audio-1')
	})

	it('returns null when there are no tracks', () => {
		expect(resolveSelectedAudioId([], 'a')).toBeNull()
	})
})
