import { useQuery } from '@tanstack/react-query'
import { searchMovies, searchTv } from '../data/tmdb'
import type { MediaItem } from '../types/media'

async function searchAll(query: string): Promise<MediaItem[]> {
	const [movies, tv] = await Promise.all([searchMovies(query), searchTv(query)])
	return [...movies, ...tv]
}

export function useSearchQuery(query: string) {
	return useQuery({
		queryKey: ['search', query],
		queryFn: () => searchAll(query),
		enabled: query.length >= 2,
		staleTime: 2 * 60_000,
		retry: 1,
	})
}
