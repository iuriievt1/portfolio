import type { MKAudioTrack } from '@mediakind/mkplayer'
import { formatLanguageName, isLanguageTag } from './language-names'

// The SDK synthesises `{ label: 'und', lang: '' }` when audio is muxed into the video
// variants instead of being a separate rendition — never surface that code in the UI.
const PLACEHOLDER_AUDIO_LABEL_PATTERN = /^(und|unknown|undefined|audio|track)[\s_-]*\d*$/i

/** Streams with no language metadata are English in this catalogue. */
const DEFAULT_AUDIO_LABEL = 'English'

// Multiview mosaic feed id: a language code plus a one-character feed suffix (`eng_A`, `es-mx-B`).
const FEED_LABEL_PATTERN = /^([a-z]{2,3}(?:[-_][a-z]{2,4})?)[_-]([a-z0-9])$/i

/** Feed key from a multiview track label (`eng_A` -> `A`), or null when it is not one. */
export function parseFeedKey(label?: string): string | null {
	const match = FEED_LABEL_PATTERN.exec(label?.trim() ?? '')
	return match ? match[2].toUpperCase() : null
}

function isPlaceholderAudioLabel(label: string): boolean {
	return PLACEHOLDER_AUDIO_LABEL_PATTERN.test(label.trim())
}

export function formatAudioTrackLabel(track: Pick<MKAudioTrack, 'label' | 'lang'>): string {
	const label = track.label?.trim() ?? ''
	const lang = track.lang?.trim() ?? ''

	// `eng_A` names a language, not a feed — the suffix travels separately as `feedKey`.
	const feed = FEED_LABEL_PATTERN.exec(label)
	if (feed) return formatLanguageName(lang) ?? formatLanguageName(feed[1]) ?? feed[1]

	const isCode = !label || isPlaceholderAudioLabel(label) || isLanguageTag(label)

	// A human label (`English (Commentary)`) is already the name.
	if (!isCode) return label

	const resolved = formatLanguageName(lang) ?? formatLanguageName(label)
	if (resolved) return resolved

	// `und`/empty means the stream declares no language at all.
	if (!label || isPlaceholderAudioLabel(label)) return DEFAULT_AUDIO_LABEL

	// A real but unmapped code (`qaa`) — show exactly what the stream gave us.
	return label
}

/** Keep the SDK's current track when it is still listed, else fall back to the first (the one playing). */
export function resolveSelectedAudioId(tracks: { id: string }[], currentId?: string | null): string | null {
	if (tracks.length === 0) return null
	if (currentId && tracks.some((t) => t.id === currentId)) return currentId
	return tracks[0].id
}

/** True when the tracks come from more than one mosaic feed, making the language alone ambiguous. */
export function spansMultipleFeeds(tracks: { feedKey?: string }[]): boolean {
	return new Set(tracks.map((t) => t.feedKey).filter(Boolean)).size > 1
}

/** Menu label. The feed is only worth naming when the list holds more than one of them. */
export function audioTrackMenuLabel(track: { label: string; feedKey?: string }, multiFeed: boolean): string {
	return multiFeed && track.feedKey ? `${track.label} (Feed ${track.feedKey})` : track.label
}
