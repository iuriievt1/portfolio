import { cn } from '@pkg/utils'
import type { SkeletonProps } from './types'

const roundedMap = {
	sm: 'rounded-sm',
	md: 'rounded-md',
	lg: 'rounded-lg',
	xl: 'rounded-xl',
	full: 'rounded-full',
} as const

export function Skeleton({ width, height, rounded = 'xl', className }: SkeletonProps) {
	return (
		<div
			className={cn('relative overflow-hidden bg-surface-3', roundedMap[rounded], className)}
			style={{ width, height }}
		>
			<div className='absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/[0.04] to-transparent' />
		</div>
	)
}
Skeleton.displayName = 'Skeleton'
