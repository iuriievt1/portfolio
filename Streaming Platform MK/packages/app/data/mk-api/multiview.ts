// Multiview (VSPP Engage) channel detection.
//
// TODO: HARD-CODED. The channel map has no flag marking a channel as multiview, so we recognise
// them by mediaId. This MUST be replaced once the backend exposes a proper multiview indicator
// (e.g. a service flag or metadata field). The runtime player additionally verifies multiview by
// inspecting the loaded stream's audio feed groups (see `isMultiviewAudio`).

/**
 * Streams we know are mosaics, with the feed count their badge should show. Only for mosaics
 * whose name does not say — anything named `…-3up` is read by `multiviewFeedCount` instead.
 *
 * `mv-test-3us` is MK's own typo for the 3-up mosaic (confirmed 2026-09-09: its manifest carries
 * three audio feed groups, `eng_A`/`spa_A` … `eng_C`/`spa_C`). Drop this entry once MK renames it.
 */
const KNOWN_MULTIVIEW: Record<string, number> = {
	'mv-test': 4,
	'mv-test-3us': 3,
}

/**
 * Any `mv-…` mediaId counts as a mosaic, so a stream MK adds is picked up without a code change.
 * Its feed count is read from the name instead (see `multiviewFeedCount`).
 */
const MULTIVIEW_MEDIA_ID_PATTERN = /^mv[-_]/i

/** `mv-3up`, `MV 2-up`, `2up` — how MK names the mosaics by feed count. */
const FEED_COUNT_PATTERN = /(\d)\s*[-_ ]?up\b/i

/**
 * A spotlight variant is the same mosaic composited with a different feed in the big tile. MK
 * ships one channel per spotlight, named off a shared base with a trailing letter
 * (`mv-test-3us`, `mv-test-3us-b`, `mv-test-3us-c`). The letter is the only thing distinguishing
 * them; a feed-count suffix like `-2up` ends in a digit-led word, so it cannot match.
 */
const SPOTLIGHT_VARIANT_PATTERN = /^(mv[-_].*?)[-_]([a-z])$/i

/** The base variant carries no letter, and canonical sources start at A. */
const BASE_SOURCE_KEY = 'A'

/** Feed counts a mosaic can have: one tile is not a mosaic, and the frame holds at most four. */
const MIN_FEEDS = 2
const MAX_FEEDS = 4

function normalize(mediaId: string | undefined | null): string {
	return mediaId?.trim().toLowerCase() ?? ''
}

/** True when a channel's playback mediaId is a multiview mosaic stream. */
export function isMultiviewMediaId(mediaId: string | undefined | null): boolean {
	const normalized = normalize(mediaId)
	if (!normalized) return false
	return normalized in KNOWN_MULTIVIEW || MULTIVIEW_MEDIA_ID_PATTERN.test(normalized)
}

/**
 * Key shared by every spotlight variant of one mosaic, so a rail can show it once. Returns the
 * mediaId itself for a mosaic MK ships without variants.
 */
export function multiviewGroupKey(mediaId: string | undefined | null): string {
	const normalized = normalize(mediaId)
	return SPOTLIGHT_VARIANT_PATTERN.exec(normalized)?.[1] ?? normalized
}

/**
 * Canonical source a mosaic variant enlarges: `mv-test-3us-b` → `B`, and the unlettered base → `A`.
 * Canonical means the order the base variant composites its sources in.
 *
 * NOT the variant's own audio feed key. Verified against the live streams (2026-09-10): MK numbers
 * every variant's feeds from `A`, so `eng_A` is whichever source that variant enlarges — the keys
 * say position, this says identity. Mixing the two swaps the audio under the viewer.
 *
 * TODO: HARD-CODED convention. The channel map says nothing about which source a variant
 * enlarges, so this reads the trailing letter MK names them with. Replace once the backend
 * states it.
 */
export function multiviewSpotlightKey(mediaId: string | undefined | null): string {
	const letter = SPOTLIGHT_VARIANT_PATTERN.exec(normalize(mediaId))?.[2]
	return letter ? letter.toUpperCase() : BASE_SOURCE_KEY
}

/**
 * Feed count for the rail card's badge, from the stream's own naming (`mv-3up` → 3). Undefined
 * when nothing names it — the badge is then hidden rather than guessed, and the player still
 * derives the real count from the stream's audio feeds once it loads.
 */
export function multiviewFeedCount(...parts: (string | undefined | null)[]): number | undefined {
	const known = KNOWN_MULTIVIEW[normalize(parts[0])]
	if (known) return known

	for (const part of parts) {
		const match = FEED_COUNT_PATTERN.exec(part?.trim() ?? '')
		const count = match ? Number(match[1]) : Number.NaN
		if (count >= MIN_FEEDS && count <= MAX_FEEDS) return count
	}
	return undefined
}
