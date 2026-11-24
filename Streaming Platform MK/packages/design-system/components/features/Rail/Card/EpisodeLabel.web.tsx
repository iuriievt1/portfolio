import { cn } from '@pkg/utils'
import { useRailDisplay } from '../hooks/use-rail'
import { useCardMeta } from './context'

type CardEpisodeLabelProps = { className?: string }

export function CardEpisodeLabel({ className }: CardEpisodeLabelProps) {
	const { item } = useCardMeta()
	const display = useRailDisplay()
	if (display.metadata === 'hidden') return null
	if (item.variant !== 'continue') return null

	const parts = [item.episodeLabel].filter(Boolean).join(' \u00b7 ')
	if (!parts) return null

	const isHover = display.metadata === 'hover'

	return (
		<p
			className={cn(
				'truncate text-meta text-white/70',
				isHover && 'opacity-0 transition-opacity duration-200 group-hover:opacity-100',
				className,
			)}
		>
			{parts}
		</p>
	)
}
CardEpisodeLabel.displayName = 'Card.EpisodeLabel'
