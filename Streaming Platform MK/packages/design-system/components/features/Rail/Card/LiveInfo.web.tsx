import { cn } from '@pkg/utils'
import { Badge } from '../../../primitives/Badge'
import { useCardMeta } from './context'

type CardLiveInfoProps = { children?: React.ReactNode; className?: string }

export function CardLiveInfo({ children, className }: CardLiveInfoProps) {
	const { item } = useCardMeta()
	if (item.variant !== 'live') return null
	const { live } = item

	return (
		<div
			className={cn(
				'flex min-w-0 flex-1 flex-col items-start gap-card-live-gap overflow-hidden p-2 md:px-3 md:pt-card-live-top md:pb-3',
				className,
			)}
		>
			<Badge intent='live' dot>
				Live
			</Badge>
			<p className='w-full truncate text-meta text-white/70'>{live.channel}</p>
			{live.episode && <p className='hidden w-full truncate text-meta text-white/60 md:block'>{live.episode}</p>}
			<p className='w-full truncate text-card-show text-white'>{live.show}</p>
			{children}
		</div>
	)
}
CardLiveInfo.displayName = 'Card.LiveInfo'
