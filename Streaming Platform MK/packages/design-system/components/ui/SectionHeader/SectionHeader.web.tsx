import { cn } from '@pkg/utils'
import { ChevronIcon } from '../../primitives/icons/Chevron'
import type { SectionHeaderProps } from './types'

export function SectionHeader({ title, subtitle, seeAllHref, seeAllLabel = 'View all' }: SectionHeaderProps) {
	return (
		<div className='flex items-center gap-3'>
			<div className='flex flex-col'>
				{title && <h2 className='font-semibold text-lg text-white tracking-tight md:text-xl'>{title}</h2>}
				{subtitle && <p className='text-muted text-sm'>{subtitle}</p>}
			</div>
			{seeAllHref && (
				<a
					href={seeAllHref}
					className={cn(
						'ml-auto flex items-center gap-0.5',
						'text-rail-arrow text-sm transition-colors hover:text-foreground',
					)}
				>
					{seeAllLabel}
					<ChevronIcon direction='right' className='h-4 w-4' />
				</a>
			)}
		</div>
	)
}
SectionHeader.displayName = 'SectionHeader'
