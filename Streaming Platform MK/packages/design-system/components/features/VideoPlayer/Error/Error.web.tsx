'use client'

import { ErrorIcon } from '../../ErrorState'
import { usePlayer } from '../hooks/use-player'

function handleReload() {
	window.location.reload()
}

function handleHome() {
	window.location.href = '/'
}

export function PlayerError() {
	const { error } = usePlayer()

	if (!error) return null

	return (
		<div data-player-error className='absolute inset-0 z-40 flex items-center justify-center bg-black/80 px-5 sm:px-8'>
			<div className='flex w-full max-w-sm flex-col items-center text-center'>
				<ErrorIcon />
				<div className='mt-4 flex flex-col items-center gap-1 sm:mt-5'>
					<p className='font-bold text-lg text-white sm:text-xl'>{error.title}</p>
					{error.description && <p className='max-w-md text-white/60 text-xs sm:text-sm'>{error.description}</p>}
				</div>
				<div className='mt-4 flex w-full gap-2 sm:mt-5'>
					<button
						type='button'
						onClick={handleReload}
						className='flex flex-1 items-center justify-center rounded-[4px] bg-white px-4 py-3 font-semibold text-black text-sm transition-opacity hover:opacity-90 sm:py-4'
					>
						Reload
					</button>
					<button
						type='button'
						onClick={handleHome}
						className='flex flex-1 items-center justify-center rounded-[4px] bg-white/10 px-4 py-3 font-semibold text-sm text-white transition-opacity hover:opacity-90 sm:py-4'
					>
						Home
					</button>
				</div>
			</div>
		</div>
	)
}
