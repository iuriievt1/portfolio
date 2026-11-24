import type { RailData } from '@pkg/design-system'

/** Max cards a rail renders. */
export const RAIL_MAX_CARDS = 20

/** Caps the rail at 20 cards and keeps "View all" only when items were left off. */
export function applyRailDisplayLimit(rail: RailData): RailData {
	const hasMore = rail.items.length > RAIL_MAX_CARDS
	if (!hasMore && !rail.viewAllHref) return rail

	return {
		...rail,
		items: hasMore ? rail.items.slice(0, RAIL_MAX_CARDS) : rail.items,
		viewAllHref: hasMore ? rail.viewAllHref : undefined,
		viewAllLabel: hasMore ? rail.viewAllLabel : undefined,
	}
}
