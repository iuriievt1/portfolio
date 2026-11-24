import { PageContent } from '@pkg/design-system/components/ui/PageContent'
import { HeroSkeleton } from '@/features/hero'
import { RailSkeleton } from '@/features/rails'

export default function DevSkeletonsPage() {
	return (
		<>
			<HeroSkeleton />
			<PageContent>
				<RailSkeleton layout='backdrop-strip' />
				<RailSkeleton layout='poster-strip' />
				<RailSkeleton layout='continue-watching' />
				<RailSkeleton layout='live-strip' />
				<RailSkeleton layout='highlights-strip' />
				<RailSkeleton layout='schedule-strip' />
				<RailSkeleton layout='multiview-strip' />
				<RailSkeleton layout='sponsored-strip' />
			</PageContent>
		</>
	)
}
