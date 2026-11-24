import { describe, expect, it } from 'vitest'
import { formatSubtitleTrackLabel } from '../components/features/VideoPlayer/utils/subtitle-labels'

describe('formatSubtitleTrackLabel', () => {
	it('uses the manifest language when the SDK label is technical', () => {
		expect(formatSubtitleTrackLabel({ label: 'text500', lang: 'en' })).toBe('English')
		expect(formatSubtitleTrackLabel({ label: 'text502', lang: 'es' })).toBe('Spanish')
	})

	it('keeps a human-readable label from the SDK', () => {
		expect(formatSubtitleTrackLabel({ label: 'English SDH', lang: 'en' })).toBe('English SDH')
	})

	it('formats bare language-code labels', () => {
		expect(formatSubtitleTrackLabel({ label: 'en', lang: 'en' })).toBe('English')
		expect(formatSubtitleTrackLabel({ label: 'FRA', lang: '' })).toBe('French')
	})

	it('shows the raw tag when the code maps to nothing', () => {
		expect(formatSubtitleTrackLabel({ label: 'qaa', lang: '' })).toBe('qaa')
	})

	it('falls back safely when no useful API language is present', () => {
		expect(formatSubtitleTrackLabel({ label: 'text500', lang: 'und' })).toBe('Subtitles')
		expect(formatSubtitleTrackLabel({ label: '', lang: '' })).toBe('Subtitles')
	})
})
