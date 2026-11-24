export type MediaKind = 'movie' | 'series' | 'live' | 'sport' | 'channel'

export type ImageRef = {
	/** Absolute URL or local /public path */
	src: string
	alt?: string
	/** Optional: for skeleton/gradient placeholders */
	colorHint?: string
}

import { z } from 'zod'

const badgeBase = z.object({ label: z.string() })

export const badgeSchema = z.discriminatedUnion('type', [
	badgeBase.extend({ type: z.literal('rating') }), // "IMDB 8.4"
	badgeBase.extend({ type: z.literal('age') }), // "16+"
	badgeBase.extend({ type: z.literal('tag') }), // "New", "Top 10"
	badgeBase.extend({ type: z.literal('live') }), // "LIVE"
])

export type Badge = z.infer<typeof badgeSchema>

export type MediaItem = {
	id: string
	kind: MediaKind

	title: string
	originalTitle?: string
	year?: number

	sport?: {
		variant: SportHoverVariant
		league?: string
		category?: string
		startsAtIso?: string
		label?: string
		timeLabel?: string
		multiCamCount?: number
		posterMode?: 'single' | 'split'
		images?: {
			a?: ImageRef
			b?: ImageRef
		}
	}

	genres?: string[]
	synopsis?: string

	poster?: ImageRef
	backdrop?: ImageRef
	logo?: ImageRef

	badges?: Badge[]

	/** movie duration or episode duration */
	durationSec?: number

	/** series */
	seasonCount?: number
	episodesCount?: number

	/** continue watching */
	episodeLabel?: string
	progress?: {
		positionSec: number
		durationSec: number
		updatedAtIso?: string
	}

	/** BE-agnostic playback placeholder */
	playback?: {
		playable: boolean
		protocol?: 'hls' | 'dash' | 'file'
		streamUrl?: string
	}

	/** extra metadata placeholders */
	meta?: {
		imdb?: number
		likes?: number
		views?: number
	}
	/** live tiles */
	live?: {
		channel?: string
		episode?: string
		ctaLabel?: string
		progress?: number
	}
	href?: string
}

export type SportHoverVariant =
	| 'default_backdrop'
	| 'continue'
	| 'sport_upcoming'
	| 'sport_replay'
	| 'sport_highlight'
	| 'sport_multicam'

export type RailLayout =
	| 'poster-strip'
	| 'backdrop-strip'
	| 'continue-watching'
	| 'featured-mini'
	| 'grid'
	| 'live-strip'
	| 'schedule-strip'
	| 'highlights-strip'
	| 'multiview-strip'
	| 'sponsored-strip'

export type Rail = {
	id: string
	title: string
	subtitle?: string
	layout: RailLayout

	ui?: {
		showArrows?: boolean
		showSeeAll?: boolean
		seeAllHref?: string
		seeAllLabel?: string
	}

	items: MediaItem[]
	hasMore?: boolean
}
