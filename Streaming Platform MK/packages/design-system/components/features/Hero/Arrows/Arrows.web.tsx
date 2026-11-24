import { cn } from '@pkg/utils'
import { ChevronIcon } from '../../../primitives/icons/Chevron'
import { useHeroState } from '../hooks/use-hero'

type ArrowsProps = {
	direction: 'left' | 'right'
	onClick: () => void
}

export function Arrows({ direction, onClick }: ArrowsProps) {
	const { state } = useHeroState()

	return (
		<button
			type='button'
			onClick={onClick}
			aria-label={direction === 'left' ? 'Previous slide' : 'Next slide'}
			className={cn(
				'-translate-y-1/2 absolute top-1/2 z-hero-controls',
				'inline-flex h-12 w-12 items-center justify-center rounded-full',
				'bg-rail-arrow-bg text-rail-arrow',
				'active:!scale-press transition-all duration-300 hover:scale-hover-lg hover:bg-rail-arrow hover:text-rail-arrow-bg',
				direction === 'left' ? 'left-4 xl:left-6' : 'right-4 xl:right-6',
				state.showControls ? 'opacity-100' : 'pointer-events-none opacity-0',
			)}
		>
			<ChevronIcon direction={direction} className='h-5 w-5' />
		</button>
	)
}
Arrows.displayName = 'Hero.Arrows'
