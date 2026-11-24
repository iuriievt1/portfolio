export const routes = {
	HOME: '/',
	SPORTS: '/sports',
	KIDS: '/kids',
	SEARCH: '/search',
	TITLE: '/title',
	GENRE: '/genre',
} as const

export type Route = (typeof routes)[keyof typeof routes]

export function titleHref(id: string) {
	return `/title?id=${encodeURIComponent(id)}`
}

export function episodeHref(titleId: string, season: number, episode: number) {
	return `/title/${titleId}/season/${season}/episode/${episode}`
}

export function genreHref(id: string) {
	return `/genre/${id}`
}
