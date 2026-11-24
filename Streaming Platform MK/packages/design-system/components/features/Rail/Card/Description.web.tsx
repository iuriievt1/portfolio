import { cn } from '@pkg/utils'
import { useRailDisplay } from '../hooks/use-rail'
import { useCardMeta } from './context'

type CardDescriptionProps = { className?: string }

export function CardDescription({ className }: CardDescriptionProps) {
	const { item } = useCardMeta()
	const display = useRailDisplay()
	if (display.metadata === 'hidden') return null
	if (!item.description) return null

	const isHover = display.metadata === 'hover'

	return (
		<p
			className={cn(
				'line-clamp-2 text-meta text-white',
				isHover && 'opacity-0 transition-opacity duration-200 group-hover:opacity-100',
				className,
			)}
		>
			{item.description}
		</p>
	)
}
CardDescription.displayName = 'Card.Description'
