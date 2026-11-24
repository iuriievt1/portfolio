import { ProgressBar } from '../../../primitives/ProgressBar'
import { useNow } from '../hooks/use-now'
import { useRailDisplay } from '../hooks/use-rail'
import { useCardMeta } from './context'
import { airingProgress } from './live-progress'

type CardProgressProps = {
	className?: string
	barClassName?: string
}

export function CardProgress({ className, barClassName }: CardProgressProps) {
	const { item } = useCardMeta()
	const display = useRailDisplay()
	const now = useNow()
	if (display.progress === 'hidden') return null

	let value: number | undefined
	if (item.variant === 'continue') value = item.progress
	if (item.variant === 'live') {
		// A live programme keeps running between fetches, so the elapsed share is derived from
		// the clock — and from the whole schedule, so one ending rolls into the next.
		value = item.live?.schedule ? airingProgress(item.live.schedule, now) : item.live?.progress
	}

	// Guard against NaN and clamp to [0, 1]
	if (value != null) {
		if (Number.isNaN(value)) value = 0
		value = Math.min(Math.max(value, 0), 1)
	}

	if (value == null) return null

	const isLive = item.variant === 'live'

	return <ProgressBar value={value} className={className} barClassName={isLive ? 'bg-live' : barClassName} />
}
CardProgress.displayName = 'Card.Progress'
