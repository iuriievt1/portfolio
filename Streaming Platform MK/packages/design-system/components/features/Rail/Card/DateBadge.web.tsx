import { cn } from '@pkg/utils'
import { useCardMeta } from './context'

type CardDateBadgeProps = { className?: string }

export function CardDateBadge({ className }: CardDateBadgeProps) {
	const { item } = useCardMeta()
	// Live-event start tag (startsAt, any variant) or the sports schedule time (scheduledAt).
	const label = item.startsAt ?? (item.variant === 'schedule' ? item.scheduledAt : undefined)
	if (!label) return null

	return (
		<span
			className={cn(
				'absolute top-1.5 right-1.5 z-10 rounded-md bg-white/15 px-1.5 py-0.5 text-badge text-white backdrop-blur-sm sm:top-card-inset sm:right-card-inset sm:px-2.5 sm:py-1',
				className,
			)}
		>
			{label}
		</span>
	)
}
CardDateBadge.displayName = 'Card.DateBadge'
