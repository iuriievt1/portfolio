'use client'

import { BrowseGridSkeleton } from '@pkg/app/features/browse'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { BrowsePageClient } from '@/features/browse'

function BrowsePageInner() {
	const searchParams = useSearchParams()
	const feedId = searchParams.get('feed')

	if (!feedId) {
		return (
			<div className='flex min-h-[50vh] items-center justify-center'>
				<p className='text-lg text-white'>No feed specified</p>
			</div>
		)
	}

	return <BrowsePageClient feedId={feedId} />
}

export default function BrowsePage() {
	return (
		<Suspense fallback={<BrowseGridSkeleton />}>
			<BrowsePageInner />
		</Suspense>
	)
}
