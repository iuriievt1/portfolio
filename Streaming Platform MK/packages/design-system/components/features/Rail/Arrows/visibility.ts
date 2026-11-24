export type RailScrollEdges = { isMobile: boolean; canLeft: boolean; canRight: boolean }
export type RailArrowVisibility = { left: boolean; right: boolean }

/** Arrows advertise off-screen cards, so they track scroll position only — never hover. */
export function railArrowVisibility({ isMobile, canLeft, canRight }: RailScrollEdges): RailArrowVisibility {
	if (isMobile) return { left: false, right: false }
	return { left: canLeft, right: canRight }
}
