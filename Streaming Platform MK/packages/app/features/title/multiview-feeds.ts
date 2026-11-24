// VSPP Engage multiview = ONE composited mosaic stream. The feeds are NOT separate videos —
// they are baked into a single mosaic frame, and each feed is a separate audio track (e.g.
// `eng_A`/`spa_A` … `eng_D`/`spa_D`). Switching feed = selecting its audio track. How many feeds
// the stream carries is whatever the audio suffixes say; their tiles come from `mosaicLayout`.

/** Minimal audio-track shape — matches design-system `AudioTrackOption`. */
export type AudioFeedTrack = {
	id: string
	label: string
	lang: string
	/** Mosaic feed key, parsed from the raw SDK label by the design system. */
	feedKey?: string
}

/** One mosaic feed (a tile), with its per-language audio tracks. */
export type MultiViewFeed = {
	/** Feed key parsed from the track label suffix, e.g. `A`. */
	key: string
	/** Display label, e.g. `Feed A`. */
	label: string
	/** Position in the mosaic layout, matching the tile at the same index in `mosaicLayout`. */
	index: number
	/** Audio tracks for this feed, one per language. */
	tracks: AudioFeedTrack[]
	/** Preferred audio track id (English first, else first available). */
	defaultAudioId: string
}

const ENGLISH_LANGS = new Set(['en', 'eng', 'en-us', 'en-gb'])

function isEnglish(track: AudioFeedTrack): boolean {
	return ENGLISH_LANGS.has(track.lang.toLowerCase())
}

/**
 * Group audio tracks into mosaic feeds by their `feedKey` (`eng_A` → feed `A`).
 * Feeds are ordered alphabetically by key, which is the order their tiles are laid out in.
 * Returns [] when the tracks do not look like a multiview mosaic (see `isMultiviewAudio`).
 */
export function groupAudioFeeds(tracks: AudioFeedTrack[]): MultiViewFeed[] {
	const byKey = new Map<string, AudioFeedTrack[]>()
	for (const track of tracks) {
		const key = track.feedKey
		if (!key) continue
		const list = byKey.get(key) ?? []
		list.push(track)
		byKey.set(key, list)
	}

	if (byKey.size < 2) return []

	return [...byKey.keys()].sort().map((key, index) => {
		const feedTracks = byKey.get(key) ?? []
		const preferred = feedTracks.find(isEnglish) ?? feedTracks[0]
		return {
			key,
			label: `Feed ${key}`,
			index,
			tracks: feedTracks,
			defaultAudioId: preferred?.id ?? '',
		}
	})
}

/** True when the audio tracks form a multiview mosaic (≥2 distinct feed keys). */
export function isMultiviewAudio(tracks: AudioFeedTrack[]): boolean {
	return groupAudioFeeds(tracks).length >= 2
}

/**
 * Which source each tile of a loaded variant shows, in tile order (index 0 is the big tile).
 *
 * Verified against the live streams (2026-09-10): MK numbers every variant's feeds from `A`
 * regardless of what it composites, so a variant's own feed keys say only *where* a source sits,
 * never *which* source it is — `eng_A` is always the big tile. Position A therefore holds the
 * variant's own source and the rest follow in canonical order, which is the order the base
 * variant composites them.
 *
 * `canonical` is that base order; `loaded` is the source the current variant enlarges.
 */
export function spotlightTileSources(canonical: string[], loaded: string): string[] {
	if (!canonical.includes(loaded)) return canonical
	return [loaded, ...canonical.filter((key) => key !== loaded)]
}
