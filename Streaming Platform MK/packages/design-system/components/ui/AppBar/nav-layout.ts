/** Rounding headroom, so a nav that lands exactly on the row width is not collapsed by a sub-pixel. */
export const NAV_FIT_SLACK = 1

type NavLayoutInput = {
	/** Row width inside its padding. 0 while the row has not been measured. */
	available: number
	logoWidth: number
	/** Natural width of the inline nav, measured whether or not it is currently shown. */
	navWidth: number
	/** Search, account trigger and menu button, as they render in the state being measured. */
	rightWidth: number
	/** Row column gap, charged either side of the nav. */
	gap: number
}

/**
 * A fixed viewport breakpoint cannot know how wide the labels are, so a store with longer
 * names overflows the row and the clipped overflow takes the account trigger with it (#81).
 * Measuring the parts decides it instead.
 */
export function shouldCollapseNav({ available, logoWidth, navWidth, rightWidth, gap }: NavLayoutInput): boolean {
	if (available <= 0 || navWidth <= 0) return false
	return logoWidth + gap + navWidth + gap + rightWidth > available + NAV_FIT_SLACK
}
