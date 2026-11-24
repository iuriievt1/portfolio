'use client'

import type { ReactNode } from 'react'
import { useControls } from '../hooks/use-controls'

type ControlsProps = {
	children: ReactNode
}

export function Controls({ children }: ControlsProps) {
	const { visible, activeMenu } = useControls()
	const show = visible || activeMenu !== null

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only, keyboard handled globally
		<div
			data-player-controls
			className={`absolute right-0 bottom-0 left-0 transition-opacity duration-300 ${
				show ? 'opacity-100' : 'pointer-events-none opacity-0'
			}`}
			onClick={(e) => e.stopPropagation()}
		>
			{/* Gradient background */}
			<div className='pointer-events-none absolute right-0 bottom-0 left-0 h-1/2 bg-gradient-to-t from-black/90 via-black/55 to-transparent' />

			{/* Content */}
			<div className='relative px-4 pb-4 md:px-[29px] md:pb-[10px]'>{children}</div>
		</div>
	)
}
