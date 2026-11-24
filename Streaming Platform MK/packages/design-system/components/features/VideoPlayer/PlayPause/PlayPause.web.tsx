'use client'

import { useCallback } from 'react'
import { PauseIcon, PlayIcon } from '../../../../icons/VideoPlayer'
import { usePlayback } from '../hooks/use-playback'

export function PlayPause() {
	const { isPlaying, play, pause } = usePlayback()

	const handleToggle = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			isPlaying ? pause() : play()
		},
		[isPlaying, play, pause],
	)

	return (
		<button
			type='button'
			aria-label={isPlaying ? 'Pause' : 'Play'}
			data-player-playpause
			onClick={handleToggle}
			className='flex items-center justify-center rounded-full px-2 py-0.5 transition-colors duration-200 hover:bg-white/30 md:px-[15px] md:py-[5px]'
		>
			{isPlaying ? (
				<PauseIcon className='h-4 w-4 text-white sm:h-5 sm:w-5 md:h-[29px] md:w-[29px]' />
			) : (
				<PlayIcon className='h-4 w-4 text-white sm:h-5 sm:w-5 md:h-[29px] md:w-[29px]' />
			)}
		</button>
	)
}
