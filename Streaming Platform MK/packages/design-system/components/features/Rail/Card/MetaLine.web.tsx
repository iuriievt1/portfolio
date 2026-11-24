import { cn } from '@pkg/utils'
import { useCardMeta } from './context'

type CardMetaLineProps = { className?: string }

export function CardMetaLine({ className }: CardMetaLineProps) {
	const { item } = useCardMeta()

	let text: string | undefined
	if (item.variant === 'highlights' || item.variant === 'multiview' || item.variant === 'sponsored') {
		text = item.metaLine
	}
	if (!text) return null

	return <p className={cn('truncate text-meta text-white/70', className)}>{text}</p>
}
CardMetaLine.displayName = 'Card.MetaLine'
