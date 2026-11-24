// FIXME: Blank overlay — should be a proper skeleton with content placeholders
// (badge, title, description, CTA) matching HeroSkeleton.tsx patterns.
interface HeroLoadingProps {
	isLoading: boolean
}

export function Loading({ isLoading }: HeroLoadingProps) {
	if (!isLoading) return null
	return <div className='absolute inset-0 bg-page-bg' />
}
Loading.displayName = 'Hero.Loading'
