'use client'

import type { MKThumbnail } from '@mediakind/mkplayer'
import { cn } from '@pkg/utils'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlayback } from '../hooks/use-playback'
import { usePlayer } from '../hooks/use-player'
import { formatClockTime, formatTime } from '../utils/format-time'
import { calculateTimelineProgress, toWallClockMs } from '../utils/playback-live'

/** getThumbnail() throws on every scrub frame for streams with no thumbnail track — log the first one only. */
let thumbnailErrorLogged = false

/** How often the live hover label re-reads the clock while the pointer rests on the bar. */
const HOVER_CLOCK_TICK_MS = 1000

/**
 * How close to an end of the track the hover label stops centring itself and aligns to that edge.
 * Roughly half the widest label — `HH:MM:SS` in mono at this size — so it never spills off the bar.
 */
const LABEL_EDGE_MARGIN = 48

/**
 * How long the bar eases towards its true position after a live seek. A seek takes the player
 * the best part of a second, and the live edge keeps moving while it works, so the playhead
 * lands a little further behind live than the click asked for. The correction is honest — easing
 * it just stops it reading as a glitch.
 */
const SEEK_SETTLE_MS = 1200

export function Timeline() {
	const { currentTime, duration, seek, isPlaying, pause, play, canSeek, isLive } = usePlayback()
	const { player } = usePlayer()
	const trackRef = useRef<HTMLDivElement>(null)
	const wasPlayingRef = useRef(false)
	const [isSeeking, setIsSeeking] = useState(false)
	const [seekTime, setSeekTime] = useState(0)
	const [isHovering, setIsHovering] = useState(false)
	const [hoverRatio, setHoverRatio] = useState(0)
	const [hoverX, setHoverX] = useState(0)
	// The window as it stood when the pointer last moved. Frozen so the label measures a fixed
	// distance behind the live edge; the clock it is subtracted from stays live.
	const [hoverWindow, setHoverWindow] = useState<{ timelineTime: number; duration: number } | null>(null)
	const [nowMs, setNowMs] = useState(() => Date.now())
	const [thumbnail, setThumbnail] = useState<MKThumbnail | null>(null)
	const [isSettling, setIsSettling] = useState(false)
	const dragCleanupRef = useRef<(() => void) | null>(null)
	const settleTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

	// Clean up drag listeners if component unmounts mid-drag
	useEffect(() => {
		return () => {
			dragCleanupRef.current?.()
			clearTimeout(settleTimerRef.current)
		}
	}, [])

	const settleAfterSeek = useCallback(() => {
		clearTimeout(settleTimerRef.current)
		setIsSettling(true)
		settleTimerRef.current = setTimeout(() => setIsSettling(false), SEEK_SETTLE_MS)
	}, [])

	// The label is a wall clock, so it has to tick even while nothing else re-renders.
	useEffect(() => {
		if (!isLive || !isHovering) return
		setNowMs(Date.now())
		const id = setInterval(() => setNowMs(Date.now()), HOVER_CLOCK_TICK_MS)
		return () => clearInterval(id)
	}, [isLive, isHovering])

	const getTimeFromX = useCallback(
		(clientX: number) => {
			const track = trackRef.current
			if (!track || !canSeek || duration === 0) return 0
			const rect = track.getBoundingClientRect()
			const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
			return pct * duration
		},
		[duration, canSeek],
	)

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (!canSeek) return
			e.stopPropagation()
			e.preventDefault()
			const time = getTimeFromX(e.clientX)
			setIsSeeking(true)
			setSeekTime(time)

			// Pause during drag so the playhead doesn't fight the user
			wasPlayingRef.current = isPlaying
			if (isPlaying) pause()

			const onMove = (ev: MouseEvent) => {
				const t = getTimeFromX(ev.clientX)
				setSeekTime(t)
			}
			const cleanup = () => {
				window.removeEventListener('mousemove', onMove)
				window.removeEventListener('mouseup', onUp)
				dragCleanupRef.current = null
			}
			const onUp = (ev: MouseEvent) => {
				const t = getTimeFromX(ev.clientX)
				seek(t)
				settleAfterSeek()
				setIsSeeking(false)
				if (wasPlayingRef.current) play()
				cleanup()
			}
			window.addEventListener('mousemove', onMove)
			window.addEventListener('mouseup', onUp)
			dragCleanupRef.current = cleanup
		},
		[getTimeFromX, seek, settleAfterSeek, isPlaying, pause, play, canSeek],
	)

	/**
	 * Place the pointer on the track and, for live, freeze how far behind the live edge it sits.
	 *
	 * Only the distance is frozen, not the resulting time. The right-hand end of the bar is the
	 * live edge, so a pointer resting there has to keep reading the current time; every position
	 * before it therefore has to advance too, or the axis would be discontinuous. What must not
	 * move is the window the distance was measured against: a channel whose DVR window is still
	 * filling grows it by a whole segment every couple of seconds, and re-deriving the distance
	 * from it walked the displayed seconds forwards and then back.
	 */
	const updateHover = useCallback(
		(clientX: number) => {
			const track = trackRef.current
			if (!track) return
			const rect = track.getBoundingClientRect()
			const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
			const ratio = rect.width > 0 ? x / rect.width : 0
			setHoverX(x)
			setHoverRatio(ratio)
			setHoverWindow(isLive ? { timelineTime: ratio * duration, duration } : null)
			setNowMs(Date.now())
		},
		[isLive, duration],
	)

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!canSeek) return
			const track = trackRef.current
			if (!track) return
			const time = getTimeFromX(e.clientX)
			updateHover(e.clientX)

			// SDK thumbnail — returns null if no thumbnail track in stream
			if (player) {
				try {
					setThumbnail(player.getThumbnail(time))
				} catch (err) {
					// Logged once: this fires on every scrub frame when the stream has no thumbnail track.
					if (!thumbnailErrorLogged) {
						thumbnailErrorLogged = true
						console.warn('[VideoPlayer] getThumbnail() failed — no thumbnail track? (logged once)', err)
					}
					setThumbnail(null)
				}
			}
		},
		[getTimeFromX, player, canSeek, updateHover],
	)

	const handleMouseLeave = () => {
		setIsHovering(false)
		setThumbnail(null)
	}

	const hoverTime = hoverRatio * duration
	const hoverWallClockMs = hoverWindow ? toWallClockMs({ ...hoverWindow, nowMs }) : null
	const hoverLabel = hoverWallClockMs === null ? formatTime(hoverTime) : formatClockTime(hoverWallClockMs)
	const displayTime = isSeeking ? seekTime : currentTime
	const progress = calculateTimelineProgress({ displayTime, duration })
	// Only while a live seek settles: dragging must track the pointer exactly, and outside that
	// window an eased bar would lag behind ordinary playback instead of looking smooth.
	const isEasing = isLive && isSettling && !isSeeking
	const easeClass = isEasing ? 'transition-[width,left] duration-[250ms] ease-out' : ''
	const thumbClass = cn(
		'-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 h-[11px] w-[11px] rounded-full bg-white shadow',
		isEasing ? 'transition-[opacity,left] duration-[250ms] ease-out' : 'transition-opacity',
		canSeek && (isHovering || isSeeking) ? 'opacity-100' : 'opacity-0',
	)

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only, keyboard handled globally
		<div
			data-player-timeline
			className='group relative min-w-0 flex-1 py-3'
			aria-disabled={!canSeek}
			onMouseEnter={(e) => {
				if (!canSeek) return
				setIsHovering(true)
				// Without this the label renders an unplaced pointer until the first move event.
				updateHover(e.clientX)
			}}
			onMouseLeave={handleMouseLeave}
			onMouseMove={handleMouseMove}
			onClick={(e) => e.stopPropagation()}
		>
			{/* Hover preview — thumbnail + timestamp */}
			{canSeek && isHovering && duration > 0 && (
				<div
					className='pointer-events-none absolute bottom-full mb-3 flex flex-col items-center'
					style={{
						left: `${hoverX}px`,
						transform: `translateX(${hoverX < LABEL_EDGE_MARGIN ? '0' : hoverX > (trackRef.current?.clientWidth ?? 0) - LABEL_EDGE_MARGIN ? '-100%' : '-50%'})`,
					}}
				>
					{thumbnail ? (
						<div
							className='overflow-hidden rounded border border-white'
							style={{
								width: thumbnail.width,
								height: thumbnail.height,
								backgroundImage: `url(${thumbnail.url})`,
								backgroundPosition: `-${thumbnail.x}px -${thumbnail.y}px`,
								backgroundSize: 'auto',
							}}
						/>
					) : null}
					<div className='mt-1 px-2 py-1 text-center'>
						<span className='font-mono text-white text-xs'>{hoverLabel}</span>
					</div>
				</div>
			)}

			{/* Track */}
			<div
				ref={trackRef}
				className={cn(
					'relative h-[5px] w-full rounded-full',
					canSeek ? 'cursor-pointer bg-white/30' : 'cursor-default bg-white/20',
				)}
				onMouseDown={handleMouseDown}
			>
				{/* Fill */}
				<div
					className={cn('absolute top-0 left-0 h-full rounded-full', canSeek ? 'bg-white' : 'bg-white/30', easeClass)}
					style={{ width: `${canSeek ? progress : 0}%` }}
				/>

				{/* Hover position indicator */}
				{canSeek && isHovering && (
					<div
						className='pointer-events-none absolute top-0 left-0 h-full rounded-full bg-white/20'
						style={{ width: `${calculateTimelineProgress({ displayTime: hoverTime, duration })}%` }}
					/>
				)}

				{/* Thumb */}
				<div className={thumbClass} style={{ left: `${progress}%` }} />
			</div>
		</div>
	)
}
