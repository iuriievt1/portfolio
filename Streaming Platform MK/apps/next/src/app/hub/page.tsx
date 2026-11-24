'use client'

import { t } from '@pkg/app'
import { useHubPageQuery } from '@pkg/app/hooks/queries'
import { useHubBySlug } from '@pkg/app/hooks/use-hub-registry'
import { ErrorState } from '@pkg/design-system/components/features/ErrorState'
import { PageContent } from '@pkg/design-system/components/ui/PageContent'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { HeroClient, HeroSkeleton } from '@/features/hero'
import { RailClient, RailSkeleton } from '@/features/rails'

function HubPageInner() {
	const searchParams = useSearchParams()
	const slug = searchParams.get('slug')

	const { data: hub, isLoading: hubLoading } = useHubBySlug(slug ?? '')
	const { data, isLoading, error } = useHubPageQuery(hub?.id)

	if (!slug || (!hubLoading && !hub)) {
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

export default function HubPage() {
	return (
		<Suspense
			fallback={
				<>
					<HeroSkeleton />
					<PageContent>
						<RailSkeleton />
						<RailSkeleton />
					</PageContent>
				</>
			}
		>
			<HubPageInner />
		</Suspense>
	)
}
