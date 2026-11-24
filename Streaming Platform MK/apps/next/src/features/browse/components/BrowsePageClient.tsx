'use client'

import { BrowseGridSkeleton, BrowseScreen } from '@pkg/app/features/browse'
import { useBrowseFeedQuery } from '@pkg/app/hooks/queries'

export function BrowsePageClient({ feedId }: { feedId: string }) {
	const { rail, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useBrowseFeedQuery(feedId)

	if (error) {
		return (
			<div className='flex min-h-[50vh] items-center justify-center'>
				<div className='text-center'>
					<p className='text-lg text-red-400'>Failed to load page</p>
					<p className='mt-2 text-sm text-white/40'>{error.message}</p>
				</div>
			</div>
		)
	}

	if (isLoading) {
		return <BrowseGridSkeleton />
	}

	return (
		<BrowseScreen
			rail={rail ?? null}
			onLoadMore={() => fetchNextPage()}
			hasNextPage={hasNextPage}
			isFetchingNextPage={isFetchingNextPage}
		/>
	)
}
