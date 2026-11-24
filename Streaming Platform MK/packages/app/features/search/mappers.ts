import type { PosterItem, RailData } from '@pkg/design-system'
import type { MediaItem } from '../../types/media'

export function toSearchResultsRail(results: MediaItem[], query: string): RailData {
	const safeQuery = query.trim().replace(/<[^>]*>/g, '')
	const title = safeQuery ? `Results for "${safeQuery.replace(/"/g, "'")}"` : 'Search Results'

	return {
		id: 'search-results',
		title,
		variant: 'poster',
		items: results.map(
			(item): PosterItem => ({
				variant: 'poster',
				id: item.id,
				title: item.title,
				imageUrl: item.poster?.src ?? item.backdrop?.src ?? '',
				href: `/title?id=${encodeURIComponent(item.id)}`,
			}),
		),
	}
}
