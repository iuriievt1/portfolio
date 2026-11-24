'use client'

import { TitleDetailScreen } from '@pkg/app/features/title'
import { useTitleDetailQuery } from '@pkg/app/hooks/queries'

export function TitlePageClient({ id }: { id: string }) {
	const { data: title, isLoading, error } = useTitleDetailQuery(id)

	if (error) {
		return (
			<div className='flex min-h-[50vh] items-center justify-center'>
				<div className='text-center'>
					<p className='text-lg text-red-400'>Failed to load title</p>
					<p className='mt-2 text-sm text-white/40'>{error.message}</p>
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className='fixed inset-0 z-50 flex items-center justify-center bg-black'>
				<div
					className='aspect-square w-[15vmin] min-w-[48px] max-w-[160px] animate-spin rounded-full border-[0.35vmin] border-white/20 border-t-white'
					style={{ transform: 'rotate(45deg)' }}
				/>
			</div>
		)
	}

	return <TitleDetailScreen id={id} title={title ?? null} />
}
