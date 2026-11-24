import { TitlePageClient } from '@/features/title'

/** No build-time API calls. Title pages render client-side via CloudFront error response fallback to index.html. */
export function generateStaticParams() {
	return [{ id: '_placeholder' }]
}

type Props = {
	params: Promise<{ id: string }>
}

export default async function TitlePage({ params }: Props) {
	const { id } = await params
	return <TitlePageClient id={id} />
}
