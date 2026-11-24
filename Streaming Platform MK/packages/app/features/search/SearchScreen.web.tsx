'use client'

import type { RailData } from '@pkg/design-system'
import { Rail } from '@pkg/design-system'
import { useCallback, useState } from 'react'
import { useSearchQuery } from '../../hooks/use-search'
import { t } from '../../i18n'
import { toSearchResultsRail } from './mappers'

export function SearchScreen() {
	const [query, setQuery] = useState('')
	const { data: results, isLoading } = useSearchQuery(query)

	const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setQuery(e.target.value)
	}, [])

	const rail: RailData | null = results && results.length > 0 ? toSearchResultsRail(results, query) : null

	return (
		<div className='flex flex-1 flex-col gap-6 px-[var(--page-pad-sm)] py-8 lg:px-[var(--page-pad-lg)] xl:px-[var(--page-pad-xl)]'>
			<div className='flex flex-col gap-2'>
				<h1 className='font-bold text-2xl text-white'>{t('search.title')}</h1>
				<input
					// biome-ignore lint/a11y/noAutofocus: search page should auto-focus the input
					autoFocus
					type='text'
					value={query}
					onChange={handleInput}
					placeholder={t('search.placeholder')}
					className='w-full max-w-md rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/40 focus:border-white/40'
				/>
			</div>

			{isLoading && query.length >= 2 && <p className='text-white/60'>{t('search.searching')}</p>}

			{!isLoading && results && results.length === 0 && query.length >= 2 && (
				<p className='text-white/60'>{t('search.noResults', { query })}</p>
			)}

			{rail && (
				<Rail id={rail.id} rail={rail}>
					<Rail.Title title={rail.title} />
					<Rail.Cards items={rail.items} />
				</Rail>
			)}
		</div>
	)
}
