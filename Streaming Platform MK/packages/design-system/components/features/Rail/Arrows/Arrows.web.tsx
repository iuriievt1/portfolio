import { cn } from '@pkg/utils'
import { ChevronIcon } from '../../../primitives/icons/Chevron'

type ArrowsProps = {
	direction: 'left' | 'right'
	onClick: () => void
}

export function Arrows({ direction, onClick }: ArrowsProps) {
	return (
		<button
			type='button'
			onClick={onClick}
			aria-label={direction === 'left' ? 'Previous' : 'Next'}
			className={cn(
				'inline-flex h-8 w-8 items-center justify-center rounded-full',
				'bg-rail-arrow-bg text-rail-arrow',
				'transition-all duration-150',
				'active:!scale-press hover:scale-hover-md hover:bg-rail-arrow hover:text-rail-arrow-bg',
			)}
		>
			<ChevronIcon direction={direction} className='h-4 w-4' />
		</button>
	)
}
Arrows.displayName = 'Rail.Arrows'
