'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GhostPauseIcon, PlayIcon } from '../../../../icons/VideoPlayer'
import { DURATION } from '../../../../tokens'
import { usePlayback } from '../hooks/use-playback'

type GhostState = {
	icon: 'play' | 'pause'
	key: number
	fading: boolean
} | null

export function Ghost() {
	const { isPlaying } = usePlayback()
	const prevPlaying = useRef(isPlaying)
	const [ghost, setGhost] = useState<GhostState>(null)
	const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

	const clearGhost = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current)
		timerRef.current = undefined
	}, [])

	useEffect(() => {
		if (prevPlaying.current !== isPlaying) {
			clearGhost()
			const newGhost: GhostState = {
				icon: isPlaying ? 'play' : 'pause',
				key: (ghost?.key ?? 0) + 1,
				fading: false,
			}
			setGhost(newGhost)

			// After hold period, start fading
			timerRef.current = setTimeout(() => {
				setGhost((prev) => (prev ? { ...prev, fading: true } : null))
				// After fade completes, remove
				timerRef.current = setTimeout(() => {
					setGhost(null)
				}, 300)
			}, DURATION.ghostHold)
		}
		prevPlaying.current = isPlaying
	}, [isPlaying, clearGhost, ghost?.key])

	useEffect(() => clearGhost, [clearGhost])

	if (!ghost) return null

	const Icon = ghost.icon === 'play' ? PlayIcon : GhostPauseIcon

	return (
		<div
			key={ghost.key}
			className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-300 ${
				ghost.fading ? 'opacity-0' : 'opacity-100'
			}`}
		>
			<div className='flex h-[128px] w-[128px] items-center justify-center rounded-full bg-black/40 md:h-[238px] md:w-[238px]'>
				<Icon
					className={
						ghost.icon === 'pause'
							? 'h-16 w-16 md:h-[113px] md:w-[113px]'
							: 'h-[48px] w-8 translate-x-1 md:h-[93px] md:w-[61px] md:translate-x-2'
					}
				/>
			</div>
		</div>
	)
}
