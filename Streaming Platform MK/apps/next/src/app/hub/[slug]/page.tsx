import { HubPageClient } from '@/features/hub'

/** Placeholder for static export — real slugs resolve client-side via CloudFront fallback. */
export function generateStaticParams() {
	return [{ slug: '_placeholder' }]
}

type Props = { params: Promise<{ slug: string }> }

export default async function HubPage({ params }: Props) {
	const { slug } = await params
	return <HubPageClient slug={slug} />
}
