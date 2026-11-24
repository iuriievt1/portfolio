'use client'

import { useCallback, useState } from 'react'
import { CollapseIcon, ExpandIcon } from '../../../../icons/VideoPlayer'
import { useControls } from '../hooks/use-controls'
import { Tooltip } from '../Tooltip.web'

export function Fullscreen() {
	const { isFullscreen, activeMenu, toggleFullscreen } = useControls()
	const [showTooltip, setShowTooltip] = useState(false)

	const handleToggle = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			toggleFullscreen()
		},
		[toggleFullscreen],
	)

	return (
		<div className='relative'>
			<button
				type='button'
				aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
				data-player-fullscreen
				onClick={handleToggle}
				onMouseEnter={() => setShowTooltip(true)}
				onMouseLeave={() => setShowTooltip(false)}
				className='flex items-center justify-center rounded-full px-2 py-1 transition-colors duration-200 hover:bg-white/30 md:px-[15px] md:py-[5px]'
			>
				{isFullscreen ? (
					<CollapseIcon className='h-4 w-4 text-white sm:h-5 sm:w-5 md:h-[29px] md:w-[29px]' />
				) : (
					<ExpandIcon className='h-4 w-4 text-white sm:h-5 sm:w-5 md:h-[29px] md:w-[29px]' />
				)}
			</button>
			<Tooltip label={isFullscreen ? 'Exit Full Screen' : 'Full Screen'} visible={showTooltip && activeMenu === null} />
		</div>
	)
}
