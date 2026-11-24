import { cn } from '@pkg/utils'
import { useRailDisplay } from '../hooks/use-rail'
import { useCardMeta } from './context'

type CardSubtitleProps = { className?: string }

export function CardSubtitle({ className }: CardSubtitleProps) {
	const { item } = useCardMeta()
	const display = useRailDisplay()
	if (display.metadata === 'hidden') return null
	if (!item.subtitle) return null

	const isHover = display.metadata === 'hover'

	return (
		<p
			className={cn(
				'truncate text-meta text-white/70',
				isHover && 'opacity-0 transition-opacity duration-200 group-hover:opacity-100',
				className,
			)}
		>
			{item.subtitle}
		</p>
	)
}
CardSubtitle.displayName = 'Card.Subtitle'
