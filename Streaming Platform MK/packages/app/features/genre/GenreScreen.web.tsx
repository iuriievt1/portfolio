'use client'

import type { RailData } from '@pkg/design-system'
import { PageContent } from '@pkg/design-system'
import { t } from '../../i18n'
import { Grid } from '../grid'

type GenreScreenProps = {
	id: string
	rail: RailData | null
}

export function GenreScreen({ id, rail }: GenreScreenProps) {
	if (!rail || rail.items.length === 0) return <GenreScreenEmpty id={id} />

	return (
		<PageContent>
			<div className='pt-10'>
				<p className='text-sm text-white/60'>{t('genre.viewAll')}</p>
				<h1 className='mt-6 font-semibold text-2xl text-white tracking-tight md:text-3xl'>{rail.title}</h1>
			</div>

			<div className='pt-16 sm:pt-28' />

			<Grid rail={rail} />
		</PageContent>
	)
}

function GenreScreenEmpty({ id }: { id: string }) {
	return (
		<PageContent>
			<div className='pt-10'>
				<h1 className='mb-4 font-semibold text-2xl text-white'>{t('genre.notFound')}</h1>
				<p className='text-muted'>{t('genre.noContent', { id })}</p>
			</div>
		</PageContent>
	)
}
