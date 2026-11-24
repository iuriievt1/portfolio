'use client'

import { cn } from '@pkg/utils'
import { useCallback } from 'react'
import { BackIcon } from '../../../../icons/VideoPlayer'
import { useControls } from '../hooks/use-controls'

type BackButtonProps = {
	onBack: () => void
}

export function BackButton({ onBack }: BackButtonProps) {
	const { visible } = useControls()

	const handleBack = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			onBack()
		},
		[onBack],
	)

	const wrapperClass = cn(
		'absolute top-2 left-2 z-10 inline-flex h-8 items-center gap-1 rounded-full p-1 transition-all duration-300 sm:top-4 sm:left-4 sm:h-12',
		visible ? 'opacity-100' : 'pointer-events-none opacity-0',
	)

	return (
		<div data-player-back className={wrapperClass}>
			<button
				type='button'
				aria-label='Go back'
				onClick={handleBack}
				className='flex h-full items-center gap-2 rounded-full bg-black/20 px-2 py-0.5 transition-colors hover:bg-white/20 sm:px-4 sm:py-1'
			>
				<BackIcon className='h-4 w-4 text-white sm:h-6 sm:w-6' />
			</button>
		</div>
	)
}
