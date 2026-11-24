'use client'

import { cn } from '@pkg/utils'
import { useCallback, useState } from 'react'
import { MultiViewIcon } from '../../../../icons/VideoPlayer'
import { useControls } from '../hooks/use-controls'
import { Tooltip } from '../Tooltip.web'

type MultiViewProps = {
	/** Leaves the current feed and returns to the mosaic. Omit to hide the control. */
	onSelect?: () => void
}

/** Shown while a single feed fills the frame — takes the viewer back to the mosaic. */
export function MultiView({ onSelect }: MultiViewProps) {
	const { activeMenu } = useControls()
	const [showTooltip, setShowTooltip] = useState(false)

	const handleClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			onSelect?.()
		},
		[onSelect],
	)

	if (!onSelect) return null

	return (
		<div className='relative'>
			<button
				type='button'
				aria-label='Multi View'
				onClick={handleClick}
				onMouseEnter={() => setShowTooltip(true)}
				onMouseLeave={() => setShowTooltip(false)}
				className={cn(
					'flex items-center justify-center rounded-full bg-white/20 px-2 py-1 transition-colors duration-200',
					'hover:bg-white/30 md:px-[15px] md:py-[5px]',
				)}
			>
				<MultiViewIcon className='h-4 w-4 text-white sm:h-5 sm:w-5 md:h-[29px] md:w-[29px]' />
			</button>
			<Tooltip label='Multi View' visible={showTooltip && activeMenu === null} />
		</div>
	)
}
