import { cn } from '@pkg/utils'
import { Link } from 'solito/link'
import { ChevronIcon } from '../../../primitives/icons/Chevron'

type TitleProps = {
	title: string
	viewAllHref?: string
	viewAllLabel?: string
	className?: string
}

export function Title({ title, viewAllHref, viewAllLabel = 'View all', className }: TitleProps) {
	return (
		<div className={cn('flex items-baseline gap-3', className)}>
			<h2 className='text-section-title text-white tracking-tight'>{title}</h2>
			{viewAllHref && (
				<Link
					href={viewAllHref}
					className={cn(
						'flex items-center gap-0.5 text-link text-rail-arrow transition-colors',
						'hover:text-foreground focus-visible:text-foreground focus-visible:outline-none',
						'focus-visible:underline',
					)}
				>
					{viewAllLabel}
					<ChevronIcon direction='right' className='h-4 w-4' />
				</Link>
			)}
		</div>
	)
}
Title.displayName = 'Rail.Title'
