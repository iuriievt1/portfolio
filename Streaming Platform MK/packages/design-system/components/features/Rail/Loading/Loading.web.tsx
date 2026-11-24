import { Skeleton } from '../../../primitives/Skeleton'

interface RailLoadingProps {
	isLoading: boolean
	count?: number
}

export function Loading({ isLoading, count = 6 }: RailLoadingProps) {
	if (!isLoading) return null
	return (
		<div className='flex flex-row gap-3'>
			{Array.from({ length: count }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
				<Skeleton key={i} className='aspect-video flex-1' rounded='xl' />
			))}
		</div>
	)
}
Loading.displayName = 'Rail.Loading'
