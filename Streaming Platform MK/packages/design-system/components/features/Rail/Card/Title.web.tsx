import { cn } from '@pkg/utils'
import { useRailDisplay } from '../hooks/use-rail'
import { useCardMeta } from './context'

type CardTitleProps = { className?: string }

export function CardTitle({ className }: CardTitleProps) {
	const { item } = useCardMeta()
	const display = useRailDisplay()
	if (display.title === 'hidden') return null

	const isHover = display.title === 'hover'

	return (
		<p
			className={cn(
				'line-clamp-2 text-meta text-white drop-shadow',
				isHover && 'opacity-0 transition-opacity duration-200 group-hover:opacity-100',
				className,
			)}
		>
			{item.title}
		</p>
	)
}
CardTitle.displayName = 'Card.Title'
