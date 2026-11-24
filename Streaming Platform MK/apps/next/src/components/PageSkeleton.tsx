import { PageContent } from '@pkg/design-system/components/ui/PageContent'
import { HeroSkeleton } from '@/features/hero'
import { RailSkeleton } from '@/features/rails'

export function PageSkeleton() {
	return (
		<>
			<HeroSkeleton />
			<PageContent>
				<RailSkeleton layout='backdrop-strip' />
				<RailSkeleton layout='continue-watching' />
				<RailSkeleton layout='poster-strip' />
			</PageContent>
		</>
	)
}
