'use client'

import { usePlayback } from '../hooks/use-playback'
import { usePlayer } from '../hooks/use-player'

export function Loading() {
	const { isBuffering, duration } = usePlayback()
	const { error } = usePlayer()

	if (!isBuffering || error) return null

	// Initial load: full-screen fixed overlay. Mid-playback: semi-transparent within player.
	const isInitialLoad = duration === 0
	const position = isInitialLoad ? 'fixed inset-0 z-50' : 'absolute inset-0 z-10'
	const bg = isInitialLoad ? 'bg-black' : 'bg-black/40'

	return (
		<div className={`pointer-events-none flex items-center justify-center ${position} ${bg}`}>
			<div
				className='aspect-square w-[15vmin] min-w-[48px] max-w-[160px] animate-spin rounded-full border-[0.35vmin] border-white/20 border-t-white'
				style={{ transform: 'rotate(45deg)' }}
			/>
		</div>
	)
}
