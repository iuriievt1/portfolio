/** Narrowest pill that still fits the icon, a few characters of query and the close button. */
export const SEARCH_PILL_MIN_WIDTH = 168

/** Square the collapsed search icon occupies — the pill grows leftwards out of it. */
export const SEARCH_ICON_SIZE = 36

export type SearchLayout = {
	/** Width the expanded pill renders at. */
	pillWidth: number
	/** Nav items have to step aside for the pill to stay usable. */
	hideNav: boolean
}

type SearchLayoutInput = {
	/** Space the pill can occupy with the nav items in place. */
	freeWithNav: number
	/** Space the nav items give back when hidden, trailing gap included. */
	navWidth: number
	/** Width the pill wants at this viewport. */
	preferred: number
}

/**
 * The expanded pill is right-anchored and grows leftwards over the bar, so its width has to be
 * capped by the free space next to the nav — otherwise it covers the nav items (#78).
 */
export function resolveSearchLayout({ freeWithNav, navWidth, preferred }: SearchLayoutInput): SearchLayout {
	if (freeWithNav >= preferred) return { pillWidth: preferred, hideNav: false }
	if (freeWithNav >= SEARCH_PILL_MIN_WIDTH) return { pillWidth: Math.floor(freeWithNav), hideNav: false }

	const freeWithoutNav = Math.floor(freeWithNav + navWidth)
	return { pillWidth: Math.max(SEARCH_PILL_MIN_WIDTH, Math.min(preferred, freeWithoutNav)), hideNav: true }
}
