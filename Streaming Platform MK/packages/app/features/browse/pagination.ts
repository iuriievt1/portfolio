import type { RailData } from '@pkg/design-system'
import type { BrowseRailPage } from '../../data/provider'

/** Merges paged browse results into one rail: first page's metadata, all pages' items deduped by id. */
export function mergeBrowsePages(pages: (BrowseRailPage | null | undefined)[]): RailData | null {
	const valid = pages.filter((page): page is BrowseRailPage => page != null)
	const first = valid[0]?.rail
	if (!first) return null

	const seen = new Set<string>()
	const items = valid
		.flatMap((page) => page.rail.items)
		.filter((item) => {
			if (seen.has(item.id)) return false
			seen.add(item.id)
			return true
		})

	return { ...first, items }
}
