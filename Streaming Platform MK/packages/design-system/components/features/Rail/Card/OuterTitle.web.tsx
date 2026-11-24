import { cn } from '@pkg/utils'
import { useRailDisplay } from '../hooks/use-rail'
import { useCardMeta } from './context'

type CardOuterTitleProps = { className?: string }

export function CardOuterTitle({ className }: CardOuterTitleProps) {
	const { item } = useCardMeta()
	const display = useRailDisplay()
	if (display.title === 'hidden') return null

	const isHover = display.title === 'hover'

	return (
		<p
			className={cn(
				'line-clamp-2 text-card-title text-white',
				isHover && 'opacity-0 transition-opacity duration-200 group-hover:opacity-100',
				className,
			)}
		>
			{item.title}
		</p>
	)
}
CardOuterTitle.displayName = 'Card.OuterTitle'
