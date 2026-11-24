import { GENRE_IDS } from '@pkg/app/data/genre'
import { GenrePageClient } from '@/features/genre'

export function generateStaticParams() {
	return GENRE_IDS.map((id) => ({ id }))
}

type Props = { params: Promise<{ id: string }> }

export default async function GenrePage({ params }: Props) {
	const { id } = await params
	return <GenrePageClient id={id} />
}
