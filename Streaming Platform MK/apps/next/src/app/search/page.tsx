import { SearchScreen } from '@pkg/app/features/search/SearchScreen.web'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Search',
	description: 'Search movies and TV shows on MediaKind.',
}

export default function SearchPage() {
	return <SearchScreen />
}
