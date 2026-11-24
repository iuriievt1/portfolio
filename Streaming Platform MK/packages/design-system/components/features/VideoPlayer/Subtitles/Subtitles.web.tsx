'use client'

import { cn } from '@pkg/utils'
import { useCallback, useState } from 'react'
import { SubtitlesIcon } from '../../../../icons/VideoPlayer'
import { useControls } from '../hooks/use-controls'
import { useTracks } from '../hooks/use-tracks'
import { CCMenu } from '../Menus/CCMenu.web'
import { Tooltip } from '../Tooltip.web'

export function Subtitles() {
	const { activeMenu, openMenu, closeMenu } = useControls()
	const { subtitleTracks } = useTracks()
	const [showTooltip, setShowTooltip] = useState(false)
	const isActive = activeMenu === 'cc'

	const handleToggle = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			isActive ? closeMenu() : openMenu('cc')
		},
		[isActive, closeMenu, openMenu],
	)

	const buttonClass = cn(
		'flex items-center justify-center rounded-full px-2 py-1 transition-colors duration-200 hover:bg-white/30 md:px-[15px] md:py-[5px]',
		isActive && 'bg-white/20',
	)

	// No real subtitle tracks hide the CC button entirely
	if (subtitleTracks.length === 0) return null

	return (
		<div className='relative'>
			<button
				type='button'
				aria-label='Subtitles'
				data-player-subtitles
				onClick={handleToggle}
				onMouseEnter={() => setShowTooltip(true)}
				onMouseLeave={() => setShowTooltip(false)}
				className={buttonClass}
			>
				<SubtitlesIcon className='h-4 w-4 text-white sm:h-5 sm:w-5 md:h-[29px] md:w-[29px]' />
			</button>
			<Tooltip label='Subtitles' visible={showTooltip && activeMenu === null} />
			<CCMenu />
		</div>
	)
}
