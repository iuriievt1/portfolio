import { cn } from '@pkg/utils'
import { Badge } from '../../../primitives/Badge'
import { useRailDisplay } from '../hooks/use-rail'
import type { ShowType } from '../types'
import { useCardMeta } from './context'

type CardBadgesProps = { className?: string }

function showTypeLabel(st: ShowType): string {
	return st === 'TVShow' ? 'Series' : st
}

export function CardBadges({ className }: CardBadgesProps) {
	const { item } = useCardMeta()
	const display = useRailDisplay()
	if (display.badges === 'hidden') return null

	const hasBadges =
		item.showType || item.rating || item.isAdult || (item.variant === 'continue' && (item.isLastChance || item.isFree))
	if (!hasBadges) return null

	const isHover = display.badges === 'hover'

	return (
		<div
			className={cn(
				'flex flex-wrap gap-1',
				isHover && 'opacity-0 transition-opacity duration-200 group-hover:opacity-100',
				className,
			)}
		>
			{/* Content tags hidden per request — uncomment to restore Series/PG badges */}
			{/* {item.showType && <Badge intent='showType'>{showTypeLabel(item.showType)}</Badge>} */}
			{/* {item.rating && <Badge intent='rating'>{item.rating}</Badge>} */}
			{item.isAdult && <Badge intent='adult'>18+</Badge>}
			{item.variant === 'continue' && item.isLastChance && <Badge intent='lastChance'>Last Chance</Badge>}
			{item.variant === 'continue' && item.isFree && <Badge intent='free'>Free</Badge>}
		</div>
	)
}
CardBadges.displayName = 'Card.Badges'
