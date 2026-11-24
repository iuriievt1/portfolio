'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { TitlePageClient } from '@/features/title'

function TitlePageInner() {
	const searchParams = useSearchParams()
	const id = searchParams.get('id')

	if (!id) {
		return (
			<div className='flex min-h-[50vh] items-center justify-center'>
				<div className='text-center'>
					<p className='text-lg text-white'>No title specified</p>
				</div>
			</div>
		)
	}

	return <TitlePageClient id={id} />
}

export default function TitlePage() {
	return (
		<Suspense
			fallback={
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black'>
					<div
						className='aspect-square w-[15vmin] min-w-[48px] max-w-[160px] animate-spin rounded-full border-[0.35vmin] border-white/20 border-t-white'
						style={{ transform: 'rotate(45deg)' }}
					/>
				</div>
			}
		>
			<TitlePageInner />
		</Suspense>
	)
}
