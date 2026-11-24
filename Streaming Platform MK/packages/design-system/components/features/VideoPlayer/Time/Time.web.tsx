'use client'

import { Badge } from '../../../primitives/Badge'
import { usePlayback } from '../hooks/use-playback'
import { formatTime } from '../utils/format-time'

export function Time() {
	const { currentTime, duration, isLive } = usePlayback()

	// Same badge the live rail cards use — one Figma symbol, one component.
	// The min-width matches the clock below so the row does not shift between the two.
	if (isLive) {
		return (
			<span className='inline-flex min-w-[54px] justify-end'>
				<Badge intent='live' dot>
					Live
				</Badge>
			</span>
		)
	}

	if (!duration) return <span className='min-w-[44px]' />

	const remaining = duration - currentTime

	return (
		<span className='min-w-[44px] text-right font-semibold text-sm text-white tabular-nums leading-[1.58] md:text-[18px]'>
			{formatTime(remaining)}
		</span>
	)
}
