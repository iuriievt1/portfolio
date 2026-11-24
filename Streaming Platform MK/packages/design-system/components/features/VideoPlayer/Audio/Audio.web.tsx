'use client'

import { useCallback, useMemo, useState } from 'react'
import { AudioIcon } from '../../../../icons/VideoPlayer'
import type { AudioTrackOption } from '../context'
import { useControls } from '../hooks/use-controls'
import { useTracks } from '../hooks/use-tracks'
import { AudioMenu } from '../Menus/AudioMenu.web'
import { Tooltip } from '../Tooltip.web'

type AudioProps = {
	/** Restricts the selectable tracks, e.g. to the one multiview feed on screen (#66). */
	filter?: (track: AudioTrackOption) => boolean
}

export function Audio({ filter }: AudioProps) {
	const { activeMenu, openMenu, closeMenu } = useControls()
	const { audioTracks } = useTracks()
	const tracks = useMemo(() => (filter ? audioTracks.filter(filter) : audioTracks), [audioTracks, filter])
	const [showTooltip, setShowTooltip] = useState(false)
	const isActive = activeMenu === 'audio'

	const handleToggle = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			isActive ? closeMenu() : openMenu('audio')
		},
		[isActive, closeMenu, openMenu],
	)

	// No real audio tracks — hide the audio button entirely
	if (tracks.length === 0) return null

	return (
		<div className='relative'>
			<button
				type='button'
				aria-label='Audio tracks'
				data-player-audio
				onClick={handleToggle}
				onMouseEnter={() => setShowTooltip(true)}
				onMouseLeave={() => setShowTooltip(false)}
				className={`flex items-center justify-center rounded-full px-2 py-1 transition-colors duration-200 hover:bg-white/30 md:px-[15px] md:py-[5px] ${
					isActive ? 'bg-white/20' : ''
				}`}
			>
				<AudioIcon className='h-4 w-4 text-white sm:h-5 sm:w-5 md:h-[29px] md:w-[29px]' />
			</button>
			<Tooltip label='Audio' visible={showTooltip && activeMenu === null} />
			<AudioMenu tracks={tracks} />
		</div>
	)
}
