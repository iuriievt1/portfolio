'use client'

import { t } from '@pkg/app'
import { useHubPageQuery } from '@pkg/app/hooks/queries'
import { useHubBySlug } from '@pkg/app/hooks/use-hub-registry'
import { ErrorState } from '@pkg/design-system/components/features/ErrorState'
import { PageContent } from '@pkg/design-system/components/ui/PageContent'
import { HeroClient, HeroSkeleton } from '@/features/hero'
import { RailClient, RailSkeleton } from '@/features/rails'

export function HubPageClient({ slug }: { slug: string }) {
	const { data: hub, isLoading: hubLoading } = useHubBySlug(slug)
	const { data, isLoading, error } = useHubPageQuery(hub?.id)

	// Unknown slug or error — reuse app-wide error page design
	if (!hubLoading && !hub) {
		return (
			<ErrorState
				title={t('error.notFound')}
				message={t('error.notFoundMessage')}
				actions={[
					{ label: t('error.goBack'), action: () => window.history.back(), variant: 'primary' },
					{ label: t('error.goHome'), action: '/', variant: 'secondary' },
				]}
			/>
		)
	}

	if (error) {
		return (
			<ErrorState
				title={t('error.generic')}
				message={error.message}
				actions={[
					{ label: t('error.goBack'), action: () => window.history.back(), variant: 'primary' },
					{ label: t('error.goHome'), action: '/', variant: 'secondary' },
				]}
			/>
		)
	}

	if (hubLoading || isLoading || !data) {
		return (
			<>
				<HeroSkeleton />
				<PageContent>
					<RailSkeleton />
					<RailSkeleton />
				</PageContent>
			</>
		)
	}

	return (
		<>
			{data.hero && <HeroClient hero={data.hero} />}
			<PageContent>
				{data.rails.map((rail) => (
					<RailClient key={rail.id} rail={rail} />
				))}
			</PageContent>
		</>
	)
}
