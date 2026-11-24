'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type UseTimelineSeekResult = {
	isSeeking: boolean
	seekTime: number
	handleMouseDown: (e: React.MouseEvent) => void
}

/**
 * Encapsulates timeline drag-to-seek logic.
 * Registers global mousemove/mouseup listeners during drag and cleans them up
 * on unmount to prevent leaks.
 */
export function useTimelineSeek(
	trackRef: React.RefObject<HTMLDivElement | null>,
	duration: number,
	seek: (time: number) => void,
): UseTimelineSeekResult {
	const [isSeeking, setIsSeeking] = useState(false)
	const [seekTime, setSeekTime] = useState(0)
	const dragCleanupRef = useRef<(() => void) | null>(null)

	const getTimeFromX = useCallback(
		(clientX: number) => {
			const track = trackRef.current
			if (!track || duration === 0) return 0
			const rect = track.getBoundingClientRect()
			const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
			return pct * duration
		},
		[duration, trackRef],
	)

	// Clean up global listeners on unmount (prevents leak if unmounted mid-drag)
	useEffect(() => {
		return () => {
			dragCleanupRef.current?.()
		}
	}, [])

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			e.preventDefault()
			const time = getTimeFromX(e.clientX)
			setIsSeeking(true)
			setSeekTime(time)

			const onMove = (ev: MouseEvent) => {
				setSeekTime(getTimeFromX(ev.clientX))
			}
			const onUp = (ev: MouseEvent) => {
				seek(getTimeFromX(ev.clientX))
				setIsSeeking(false)
				cleanup()
			}
			const cleanup = () => {
				window.removeEventListener('mousemove', onMove)
				window.removeEventListener('mouseup', onUp)
				dragCleanupRef.current = null
			}

			window.addEventListener('mousemove', onMove)
			window.addEventListener('mouseup', onUp)
			dragCleanupRef.current = cleanup
		},
		[getTimeFromX, seek],
	)

	return { isSeeking, seekTime, handleMouseDown }
}
