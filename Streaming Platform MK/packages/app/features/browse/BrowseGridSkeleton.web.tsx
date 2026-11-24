'use client'

import { PageContent, Skeleton } from '@pkg/design-system'
import { t } from '../../i18n'
import { HeroBackdrop } from './HeroBackdrop.web'

const SKELETON_CARDS = 12
const GRID_COLS = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6'

/** Loading state for the View All grid page — mirrors BrowseScreen so there is no layout shift. */
export function BrowseGridSkeleton() {
	return (
		<div className='relative isolate'>
			<HeroBackdrop className='-z-10 -top-[50px] md:-top-[88px] pointer-events-none absolute inset-x-0 h-[350px] w-full md:h-[430px]' />
			{/* Mirrors BrowseScreen's single-child layout + 109px title→grid gap to avoid layout shift. */}
			<PageContent>
				<div className='pt-10'>
					<p className='font-medium text-sm text-white leading-[1.58]'>{t('browse.eyebrow')}</p>
					<Skeleton width={280} height={38} rounded='md' className='mt-6' />
					<div className={`mt-[109px] grid gap-4 sm:gap-6 lg:gap-8 ${GRID_COLS}`}>
						{Array.from({ length: SKELETON_CARDS }, (_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
							<Skeleton key={i} className='aspect-video w-full' rounded='md' />
						))}
					</div>
				</div>
			</PageContent>
		</div>
	)
}
BrowseGridSkeleton.displayName = 'BrowseGridSkeleton'
