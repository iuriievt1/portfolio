import type { CardAspect, RailVariant } from '@pkg/design-system'

/** Rail variants a feed's aspect ratio can select — `continue` is subscriber-owned, not feed-driven. */
export type FeedAspectVariant = Exclude<RailVariant, 'continue'>

/**
 * MK drives the rail layout from the hub feed's `ShowcardAspectRatio`, so every card in a rail
 * uses the ratio the backend declares. The enum mixes real ratios with layout kinds that name no
 * shape at all — those map to `null`, meaning read the items' own artwork instead. Guessing a
 * shape for them crops 2x3-only feeds into 16x9 cards (`Feeds`, seen on "A - Test Hub").
 *
 * 4x3 and 3x4 reuse the landscape/portrait variants and get their real shape from
 * `showcardCardAspect` — the variant carries the card's behaviour, the aspect its shape.
 */
const SHOWCARD_VARIANTS: Record<string, FeedAspectVariant | null> = {
	sixteenbynine: 'backdrop',
	twobythree: 'poster',
	// Nearest orientation; the exact shape comes from `showcardCardAspect`.
	threebyfour: 'poster',
	fourbythree: 'backdrop',
	players: 'character',
	events: 'schedule',
	// Layout kinds, not ratios — the items decide.
	mixed: null,
	feeds: null,
	carousel: null,
	homebanner: null,
}

/** Numeric spellings some tenants send instead of MK's enum (`16x9 Showcard`, `2x3`). */
const LEGACY_RATIO_VARIANTS: [string, FeedAspectVariant][] = [
	['16x9', 'backdrop'],
	['2x3', 'poster'],
	['3x4', 'poster'],
	['4x3', 'backdrop'],
]

/** Card shapes MK declares that no variant carries on its own. */
const SHOWCARD_ASPECTS: Record<string, CardAspect> = {
	fourbythree: '4x3',
	threebyfour: '3x4',
	'4x3': '4x3',
	'3x4': '3x4',
}

function normalizeShowcardAspect(showcardAspectRatio?: string | null): string {
	return showcardAspectRatio?.trim().toLowerCase().replace(/\s+/g, '') ?? ''
}

/** Resolves a feed's `ShowcardAspectRatio` to a rail variant, or null when it declares none. */
export function showcardAspectVariant(showcardAspectRatio?: string | null): FeedAspectVariant | null {
	const normalized = normalizeShowcardAspect(showcardAspectRatio)
	if (!normalized) return null

	if (normalized in SHOWCARD_VARIANTS) return SHOWCARD_VARIANTS[normalized]

	const legacy = LEGACY_RATIO_VARIANTS.find(([ratio]) => normalized.includes(ratio))
	return legacy ? legacy[1] : null
}

/**
 * Card shape for a feed whose ratio has no variant of its own (4x3, 3x4). Null means the
 * variant's own shape already matches, so the rail needs no override.
 */
export function showcardCardAspect(showcardAspectRatio?: string | null): CardAspect | null {
	const normalized = normalizeShowcardAspect(showcardAspectRatio)
	if (!normalized) return null

	const exact = SHOWCARD_ASPECTS[normalized]
	if (exact) return exact

	const legacy = Object.keys(SHOWCARD_ASPECTS).find((ratio) => ratio.includes('x') && normalized.includes(ratio))
	return legacy ? SHOWCARD_ASPECTS[legacy] : null
}
