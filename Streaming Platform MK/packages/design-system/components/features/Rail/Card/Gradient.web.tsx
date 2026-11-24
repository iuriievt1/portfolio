import { cn } from '@pkg/utils'
import { useRailDisplay } from '../hooks/use-rail'

type CardGradientProps = {
	position?: 'bottom' | 'full'
	className?: string
}

export function CardGradient({ position = 'bottom', className }: CardGradientProps) {
	const display = useRailDisplay()
	if (display.gradient === 'hidden') return null

	const isHover = display.gradient === 'hover'

	return (
		<div
			className={cn(
				'pointer-events-none absolute inset-x-0',
				position === 'bottom'
					? 'bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent'
					: 'inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent',
				isHover && 'opacity-0 transition-opacity duration-200 group-hover:opacity-100',
				className,
			)}
		/>
	)
}
CardGradient.displayName = 'Card.Gradient'
