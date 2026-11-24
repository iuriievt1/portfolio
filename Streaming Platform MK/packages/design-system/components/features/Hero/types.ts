/**
 * Data for a single hero slide.
 *
 * Fields used by Hero.Content (VOD):
 *   tagLabel, year, duration, logoUrl
 *
 * Fields used by Hero.LiveContent (live events):
 *   tagLabel, startTime
 *
 * Fields used by Hero.BrandingLogo:
 *   brandingLogoUrl
 */
export type HeroCta = {
	label: string
	/** 'add' renders PlusIcon, 'play' renders PlayIcon, 'restart' renders RestartIcon, omit for text-only */
	icon?: 'play' | 'add' | 'restart'
	action: string
}

export type HeroItemData = {
	id: string
	title: string
	imageUrl: string
	href: string
	/** Title treatment logo — replaces text title in Hero.Content when present */
	logoUrl?: string
	/** Badge label — "Recently Added" / "New Episode" (Content) or "Live" (LiveContent) */
	tagLabel?: string
	/** Release year — used by Hero.Content for "2025 · 1h 51m" meta line */
	year?: number
	/** Runtime — used by Hero.Content for "2025 · 1h 51m" meta line */
	duration?: string
	synopsis?: string
	/** CSS object-position override, e.g. "center top" — defaults to "center" */
	imagePosition?: string
	/** Broadcast time, e.g. "16:45" — used by Hero.LiveContent for "Starting at HH:MM" */
	startTime?: string
	/** Renders the live hero treatment and "Watch Live" CTA. */
	isLive?: boolean
	/** Event/sponsor logo positioned bottom-right — used by Hero.BrandingLogo */
	brandingLogoUrl?: string
	/** Per-item secondary CTAs — overrides default buttons in LiveContent */
	ctas?: HeroCta[]
}

export type HeroData = {
	items: HeroItemData[]
	autoPlayMs?: number
}
