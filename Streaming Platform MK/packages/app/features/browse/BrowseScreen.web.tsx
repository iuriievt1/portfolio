'use client'

import type { RailData } from '@pkg/design-system'
import { PageContent } from '@pkg/design-system'
import { t } from '../../i18n'
import { Grid } from '../grid'
import { HeroBackdrop } from './HeroBackdrop.web'

type BrowseScreenProps = {
	rail: RailData | null
	onLoadMore?: () => void
	hasNextPage?: boolean
	isFetchingNextPage?: boolean
}

export function BrowseScreen({ rail, onLoadMore, hasNextPage, isFetchingNextPage }: BrowseScreenProps) {
	if (!rail || rail.items.length === 0) return <BrowseScreenEmpty />

	return (
		<div className='relative isolate'>
			{/* Extends up behind the transparent AppBar (50px sm / 88px md) so the glow sits under the header too. */}
			<HeroBackdrop className='-z-10 -top-[50px] md:-top-[88px] pointer-events-none absolute inset-x-0 h-[350px] w-full md:h-[430px]' />
			{/* Single PageContent child so its section space-y doesn't inflate the title→grid gap. */}
			<PageContent>
				<div className='pt-10'>
					<p className='font-medium text-sm text-white leading-[1.58]'>{t('browse.eyebrow')}</p>
					<h1 className='mt-6 font-bold text-3xl text-white leading-[1.2] md:text-[37.54px]'>{rail.title}</h1>
					<div className='mt-[109px]'>
						<Grid
							rail={rail}
							onLoadMore={onLoadMore}
							hasNextPage={hasNextPage}
							isFetchingNextPage={isFetchingNextPage}
						/>
					</div>
				</div>
			</PageContent>
		</div>
	)
}

function BrowseScreenEmpty() {
	return (
		<PageContent>
			<div className='pt-10'>
				<h1 className='mb-4 font-semibold text-2xl text-white'>{t('browse.notFound')}</h1>
				<p className='text-muted'>{t('browse.noContent')}</p>
			</div>
		</PageContent>
	)
}
