/**
 * Card shape, independent of the variant's semantics. MK feeds declare it via
 * `ShowcardAspectRatio`, so a backdrop rail can be 4x3 and a poster rail 3x4 without
 * a variant of its own. Unset means the variant's own default shape.
 */
export type CardAspect = 'video' | 'poster' | 'square' | '4x3' | '3x4'

export type RailVariant =
	| 'backdrop'
	| 'poster'
	| 'continue'
	| 'character'
	| 'live'
	| 'schedule'
	| 'highlights'
	| 'multiview'
	| 'sponsored'

export type ShowType = 'Movie' | 'TVShow' | 'Series' | 'Episode' | 'Season' | 'Channel'

type BaseItem = {
	id: string
	title: string
	imageUrl: string
	href: string
	subtitle?: string
	description?: string
	showType?: ShowType
	isNew?: boolean
	isAdult?: boolean
	rating?: string
	/** Pre-formatted live-event start label (e.g. "MAR 11, 3:30pm"), shown as a top-right tag. */
	startsAt?: string
}

export type BackdropItem = BaseItem & { variant: 'backdrop' }
export type PosterItem = BaseItem & { variant: 'poster' }
export type CharacterItem = BaseItem & { variant: 'character' }
export type ContinueItem = BaseItem & {
	variant: 'continue'
	progress: number
	episodeLabel?: string
	duration?: string
	isLastChance?: boolean
	isFree?: boolean
	expiresAt?: string
}
export type LiveItem = BaseItem & {
	variant: 'live'
	live: {
		channel: string
		episode?: string
		show: string
		/** Fixed fraction, for sources with no schedule (mock data). */
		progress?: number
		/**
		 * Programme windows around now. The card ticks its own progress from these and rolls
		 * over to the next one, so the bar keeps working without refetching the rail.
		 */
		schedule?: { startMs: number; endMs: number }[]
	}
}

export type ScheduleItem = BaseItem & {
	variant: 'schedule'
	scheduledAt?: string
}

export type HighlightsItem = BaseItem & {
	variant: 'highlights'
	metaLine?: string
}

export type MultiviewItem = BaseItem & {
	variant: 'multiview'
	multiviewCount?: number
	metaLine?: string
}

export type SponsoredItem = BaseItem & {
	variant: 'sponsored'
	metaLine?: string
}

export type RailItemData =
	| BackdropItem
	| PosterItem
	| CharacterItem
	| ContinueItem
	| LiveItem
	| ScheduleItem
	| HighlightsItem
	| MultiviewItem
	| SponsoredItem

export type ResponsiveCols = Partial<Record<'default' | 'lg' | 'xl' | '2xl' | '3xl', number>>

export type RailData = {
	id: string
	title: string
	variant: RailVariant
	/** Overrides the variant's default card shape (MK `ShowcardAspectRatio`). */
	aspect?: CardAspect
	items: RailItemData[]
	viewAllHref?: string
	viewAllLabel?: string
	showCardTitle?: boolean
	cols?: ResponsiveCols
	display?: Partial<import('./context').RailDisplay>
}

export type RenderCardFn = (item: RailItemData, opts: { cardW: number; index: number }) => React.ReactNode
