'use client'

import type { MKDurationChangedEvent, MKTimeChangedEvent } from '@mediakind/mkplayer'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PlaybackContext } from '../context'
import { usePlayer } from '../hooks/use-player'
import {
	type PlaybackMeta,
	resolvePlaybackMeta,
	toPlayerSeekTime,
	toTimelineTime,
	withSeekableWindow,
} from '../utils/playback-live'
import type { PlayerRuntime } from '../utils/sdk.web'

function logPlaybackMetaError(field: string, error: unknown): void {
	console.error('[VideoPlayer] Failed to read playback metadata', { field, error })
}

/**
 * EXPERIMENT — live seek latency compensation.
 *
 * A live seek takes the player the best part of a second, and the live edge keeps moving while it
 * works, so the playhead settles that much further behind live than the click asked for. Aiming
 * ahead by the latency makes it land on the clicked position instead, at the cost of playing
 * content that much later than the frame under the pointer. Delete this block and the two marked
 * sections below to go back to landing on the exact frame clicked.
 */
const INITIAL_SEEK_LATENCY = 0.7
/** Weight of the newest reading — high enough to track buffering swings within a seek or two. */
const SEEK_LATENCY_SMOOTHING = 0.5
/** Beyond this a reading is a stall, not seek latency, and would throw the estimate off. */
const MAX_SEEK_LATENCY = 3

function readPlaybackMeta(player: PlayerRuntime): PlaybackMeta {
	let rawDuration = 0
	let playerIsLive = false
	let maxTimeShift = 0
	let seekableRange = null

	try {
		rawDuration = player.getDuration()
	} catch (error) {
		logPlaybackMetaError('duration', error)
	}

	try {
		playerIsLive = player.isLive()
	} catch (error) {
		logPlaybackMetaError('isLive', error)
	}

	try {
		maxTimeShift = player.getMaxTimeShift()
	} catch (error) {
		logPlaybackMetaError('maxTimeShift', error)
	}

	try {
		seekableRange = player.getSeekableRange()
	} catch (error) {
		logPlaybackMetaError('seekableRange', error)
	}

	return resolvePlaybackMeta({ rawDuration, playerIsLive, maxTimeShift, seekableRange })
}

export function PlaybackProvider({ children }: { children: ReactNode }) {
	const { player } = usePlayer()
	const [isPlaying, setIsPlaying] = useState(false)
	const [currentTime, setCurrentTime] = useState(0)
	const [duration, setDuration] = useState(0)
	const [isLive, setIsLive] = useState(false)
	const [canSeek, setCanSeek] = useState(false)
	const [isBuffering, setIsBuffering] = useState(true)
	const playbackMetaRef = useRef<PlaybackMeta>({
		isLive: false,
		canSeek: false,
		duration: 0,
		seekableStart: 0,
		seekableEnd: 0,
	})

	// EXPERIMENT (seek latency compensation) — measured from each live seek, seeded with a guess.
	const seekLatencyRef = useRef(INITIAL_SEEK_LATENCY)
	const pendingSeekEndRef = useRef<number | null>(null)

	// Safety net: clear isBuffering after 15s if no playing event arrives.
	// Prevents infinite spinner when autoplay is fully blocked.
	const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
	useEffect(() => {
		if (!isBuffering || !player) {
			clearTimeout(bufferingTimeoutRef.current)
			return
		}
		bufferingTimeoutRef.current = setTimeout(() => setIsBuffering(false), 15_000)
		return () => clearTimeout(bufferingTimeoutRef.current)
	}, [isBuffering, player])

	/** Re-read only the sliding window. Live-ness stays as the loaded source set it. */
	const refreshWindow = useCallback((p: PlayerRuntime): PlaybackMeta => {
		const prev = playbackMetaRef.current
		if (!prev.isLive) return prev

		let range = null
		try {
			range = p.getSeekableRange()
		} catch (error) {
			logPlaybackMetaError('seekableRange', error)
			return prev
		}

		const meta = withSeekableWindow({ range, meta: prev })
		playbackMetaRef.current = meta
		if (prev.duration !== meta.duration) setDuration(meta.duration)
		if (prev.canSeek !== meta.canSeek) setCanSeek(meta.canSeek)
		return meta
	}, [])

	useEffect(() => {
		if (!player) return

		const p = player as unknown as PlayerRuntime
		const syncPlaybackMeta = () => {
			const meta = readPlaybackMeta(p)
			playbackMetaRef.current = meta
			setDuration(meta.duration)
			setIsLive(meta.isLive)
			setCanSeek(meta.canSeek)
			setCurrentTime(toTimelineTime({ rawTime: player.getCurrentTime(), meta }))
			return meta
		}

		const onPlaying = () => {
			setIsPlaying(true)
			setIsBuffering(false)
		}
		const onPaused = () => setIsPlaying(false)
		// The live window slides under the playhead, so its start has to be re-read here —
		// mapping against the window loaded with pins the scrubber at 100% within a minute.
		const onTimeChanged = (e: MKTimeChangedEvent) =>
			setCurrentTime(toTimelineTime({ rawTime: e.time, meta: refreshWindow(p) }))
		const onDurationChanged = (_e: MKDurationChangedEvent) => {
			syncPlaybackMeta()
		}
		const onStallStarted = () => setIsBuffering(true)
		const onStallEnded = () => setIsBuffering(false)
		const onSeeked = () => {
			setIsBuffering(false)

			// EXPERIMENT (seek latency compensation) — how far the live edge ran while we seeked.
			const endAtSeek = pendingSeekEndRef.current
			pendingSeekEndRef.current = null
			if (endAtSeek == null) return
			let end = 0
			try {
				end = p.getSeekableRange().end
			} catch (error) {
				logPlaybackMetaError('seekableRange', error)
				return
			}
			const advanced = end - endAtSeek
			if (!(advanced > 0) || advanced > MAX_SEEK_LATENCY) return
			const prev = seekLatencyRef.current
			seekLatencyRef.current = prev + (advanced - prev) * SEEK_LATENCY_SMOOTHING
			console.info('[VideoPlayer] seek latency', {
				advanced: +advanced.toFixed(3),
				estimate: +seekLatencyRef.current.toFixed(3),
			})
		}

		// Sync state when source finishes loading (durationchanged may fire before we subscribe)
		const onSourceLoaded = () => {
			syncPlaybackMeta()
			setIsPlaying(player.isPlaying())
			setIsBuffering(false)
		}

		p.on('playing', onPlaying as (...args: unknown[]) => void)
		p.on('paused', onPaused)
		p.on('timechanged', onTimeChanged as (...args: unknown[]) => void)
		p.on('durationchanged', onDurationChanged as (...args: unknown[]) => void)
		p.on('stallstarted', onStallStarted)
		p.on('stallended', onStallEnded)
		p.on('seeked', onSeeked)
		p.on('sourceloaded', onSourceLoaded)

		// Sync initial state — source may already be loaded
		syncPlaybackMeta()
		setIsPlaying(player.isPlaying())

		return () => {
			p.off('playing', onPlaying as (...args: unknown[]) => void)
			p.off('paused', onPaused)
			p.off('timechanged', onTimeChanged as (...args: unknown[]) => void)
			p.off('durationchanged', onDurationChanged as (...args: unknown[]) => void)
			p.off('stallstarted', onStallStarted)
			p.off('stallended', onStallEnded)
			p.off('seeked', onSeeked)
			p.off('sourceloaded', onSourceLoaded)
		}
	}, [player, refreshWindow])

	const play = useCallback(() => {
		void Promise.resolve(player?.play()).catch((e) => console.warn('[VideoPlayer]', e))
	}, [player])

	const pause = useCallback(() => {
		void Promise.resolve(player?.pause()).catch((e) => console.warn('[VideoPlayer]', e))
	}, [player])

	const seek = useCallback(
		(time: number) => {
			if (!player) return
			// Map against the window as it is now: one read at load drifts out of date within
			// seconds, and the target lands wherever that stale window has since moved to.
			const meta = refreshWindow(player as unknown as PlayerRuntime)
			const seekTime = toPlayerSeekTime({ timelineTime: time, meta })
			if (seekTime == null) return

			// EXPERIMENT (seek latency compensation) — aim at where the live edge will be once the
			// seek lands, so the playhead settles on the clicked position rather than short of it.
			// The bar still shows the clicked position, which is where it ends up.
			const target = meta.isLive ? Math.min(seekTime + seekLatencyRef.current, meta.seekableEnd) : seekTime
			pendingSeekEndRef.current = meta.isLive ? meta.seekableEnd : null

			player.seek(target)
			setCurrentTime(toTimelineTime({ rawTime: seekTime, meta }))
			setIsBuffering(true)
		},
		[player, refreshWindow],
	)

	const value = useMemo(
		() => ({ isPlaying, currentTime, duration, isLive, canSeek, isBuffering, play, pause, seek }),
		[isPlaying, currentTime, duration, isLive, canSeek, isBuffering, play, pause, seek],
	)

	return <PlaybackContext value={value}>{children}</PlaybackContext>
}
