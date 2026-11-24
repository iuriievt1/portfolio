'use client'

import { type ReactNode, useCallback, useRef } from 'react'
import { useControls } from '../hooks/use-controls'
import { useKeyboard } from '../hooks/use-keyboard.web'
import { usePlayback } from '../hooks/use-playback'

type OverlayProps = {
	children: ReactNode
}

export function Overlay({ children }: OverlayProps) {
	const { isPlaying, play, pause } = usePlayback()
	const { visible, showControls, hideControls, toggleFullscreen } = useControls()
	useKeyboard()

	// Use ref to avoid stale closure in the 200ms double-click timeout
	const isPlayingRef = useRef(isPlaying)
	isPlayingRef.current = isPlaying

	// Distinguish single click from double click
	const clickTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

	const handleClick = useCallback(
		(e: React.MouseEvent) => {
			// Stop propagation so SDK video element doesn't also toggle play/pause
			e.stopPropagation()

			if (clickTimer.current) {
				// Double click detected — cancel the single click action
				clearTimeout(clickTimer.current)
				clickTimer.current = undefined
				toggleFullscreen()
			} else {
				clickTimer.current = setTimeout(() => {
					clickTimer.current = undefined
					if (isPlayingRef.current) {
						pause()
					} else {
						play()
					}
				}, 200)
			}
		},
		[play, pause, toggleFullscreen],
	)

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled globally via useKeyboard()
		<div
			className={`absolute inset-0 z-[5] ${visible ? 'cursor-default' : 'cursor-none'}`}
			onClick={handleClick}
			onMouseMove={showControls}
			onMouseLeave={hideControls}
		>
			{children}
		</div>
	)
}
