import type { RailVariant } from '@pkg/design-system'
import type { MediaItem } from '../types/media'
import { discoverMovies, getTrendingMovies, trendingTvWeek } from './tmdb'

type GenreEntry = {
	title: string
	variant: RailVariant
	fetch: () => Promise<MediaItem[]>
}

const GENRE_REGISTRY: Record<string, GenreEntry> = {
	spotlight: {
		title: 'Spotlight',
		variant: 'backdrop',
		fetch: () => getTrendingMovies(),
	},
	action: {
		title: 'Action & Adventure',
		variant: 'poster',
		fetch: () => discoverMovies({ with_genres: '28,12', sort_by: 'popularity.desc', page: 1 }),
	},
	series: {
		title: 'Series',
		variant: 'poster',
		fetch: () => trendingTvWeek(),
	},
	cartoons: {
		title: 'Cartoons',
		variant: 'poster',
		fetch: () => discoverMovies({ with_genres: '16', sort_by: 'popularity.desc', page: 1 }),
	},
	'sports-leagues': {
		title: 'Sports & competition',
		variant: 'poster',
		fetch: () => discoverMovies({ with_genres: '28', sort_by: 'popularity.desc', page: 1 }),
	},
}

export const GENRE_IDS = Object.keys(GENRE_REGISTRY)

export type GenreMeta = { title: string; variant: RailVariant }

export function getGenreMeta(id: string): GenreMeta | null {
	const entry = GENRE_REGISTRY[id]
	if (!entry) return null
	return { title: entry.title, variant: entry.variant }
}

export async function getGenreItems(id: string): Promise<MediaItem[]> {
	const entry = GENRE_REGISTRY[id]
	if (!entry) return []

	const items = await entry.fetch()
	return items.filter((x) => !!(x.poster?.src || x.backdrop?.src))
}
