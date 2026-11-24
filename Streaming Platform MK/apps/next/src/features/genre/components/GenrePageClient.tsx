'use client'

import { GenreScreen } from '@pkg/app/features/genre'
import { useGenreQuery } from '@pkg/app/hooks/queries'

export function GenrePageClient({ id }: { id: string }) {
	const { data: rail, isLoading, error } = useGenreQuery(id)

	if (error) {
		return (
			<div className='flex min-h-[50vh] items-center justify-center'>
				<div className='text-center'>
					<p className='text-lg text-red-400'>Failed to load genre</p>
					<p className='mt-2 text-sm text-white/40'>{error.message}</p>
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className='flex min-h-[50vh] items-center justify-center'>
				<div className='h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80' />
			</div>
		)
	}

	return <GenreScreen id={id} rail={rail ?? null} />
}
