'use client'

import { cn } from '@pkg/utils'
import { useCallback, useRef, useState } from 'react'
import { MuteIcon, VolumeIcon } from '../../../../icons/VideoPlayer'
import { useVolume } from '../hooks/use-volume'
import { displayVolume } from '../utils/volume'

/** Thumb diameter, in px — the slider insets the thumb by this much across its travel. */
const THUMB_PX = 10

export function Volume() {
	const { volume, isMuted, setVolume, toggleMute } = useVolume()
	const [isExpanded, setIsExpanded] = useState(false)
	const collapseTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
	const trackRef = useRef<HTMLDivElement>(null)

	const expand = useCallback(() => {
		if (collapseTimer.current) clearTimeout(collapseTimer.current)
		setIsExpanded(true)
	}, [])

	const collapse = useCallback(() => {
		collapseTimer.current = setTimeout(() => setIsExpanded(false), 200)
	}, [])

	const handleTrackInteraction = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			e.stopPropagation()
			const track = trackRef.current
			if (!track) return

			const updateVolume = (clientX: number) => {
				const rect = track.getBoundingClientRect()
				const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
				setVolume(Math.round(pct * 100))
			}

			updateVolume(e.clientX)

			const onMove = (ev: MouseEvent) => updateVolume(ev.clientX)
			const onUp = () => {
				window.removeEventListener('mousemove', onMove)
				window.removeEventListener('mouseup', onUp)
			}
			window.addEventListener('mousemove', onMove)
			window.addEventListener('mouseup', onUp)
		},
		[setVolume],
	)

	const handleToggleMute = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			toggleMute()
		},
		[toggleMute],
	)

	const level = displayVolume({ volume, isMuted })
	const Icon = level === 0 ? MuteIcon : VolumeIcon

	// The padding stays on the container in both states. Handing it to the button on collapse
	// made the icon snap sideways, because only the container animated the swap back.
	const containerClass = cn(
		'flex items-center rounded-full px-2 py-1 transition-colors duration-200 md:px-[15px] md:py-[5px]',
		isExpanded ? 'bg-white/20' : 'hover:bg-white/20',
	)
	const buttonClass = 'flex items-center justify-center'
	// Height fits the thumb: overflow-hidden drives the collapse, and without it the wrapper
	// inherits the track height and clips the thumb into a bar (#62).
	const sliderClass = cn(
		'flex h-2.5 items-center overflow-hidden transition-all duration-200',
		isExpanded ? 'ml-1 w-[78px] opacity-100' : 'w-0 opacity-0',
	)

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only, keyboard handled globally
		<div
			data-player-volume
			className={containerClass}
			onMouseEnter={expand}
			onMouseLeave={collapse}
			onClick={(e) => e.stopPropagation()}
		>
			<button
				type='button'
				aria-label={level === 0 ? 'Unmute' : 'Mute'}
				onClick={handleToggleMute}
				className={buttonClass}
			>
				<Icon className='h-4 w-4 text-white sm:h-5 sm:w-5 md:h-[29px] md:w-[29px]' />
			</button>

			<div className={sliderClass}>
				<div
					ref={trackRef}
					className='relative h-1 w-full cursor-pointer rounded-full bg-white/30'
					onMouseDown={handleTrackInteraction}
				>
					<div className='absolute top-0 left-0 h-full rounded-full bg-white' style={{ width: `${level}%` }} />
					<div
						className='-translate-y-1/2 absolute top-1/2 h-2.5 w-2.5 rounded-full bg-white'
						// Inset by its own width so the thumb sits inside the track at both ends, per Figma.
						style={{ left: `calc(${level}% - ${(level * THUMB_PX) / 100}px)` }}
					/>
				</div>
			</div>
		</div>
	)
}
