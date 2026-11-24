'use client'

import { usePlayback } from '@pkg/design-system'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { getDataProvider } from '../../data'

const PERIODIC_INTERVAL_MS = 20_000
const MIN_DELTA_SECONDS = 3
const COMPLETION_THRESHOLD = 0.95
const PAUSED_DEBOUNCE_MS = 500

export type BookmarkReporterInput = {
	videoId: string | null
	programId: string | null
	assetType: string | undefined
}

export function useBookmarkReporter({ videoId, programId, assetType }: BookmarkReporterInput) {
	const { isPlaying, currentTime, duration, canSeek, seek } = usePlayback()

	const mutation = useMutation({
		mutationFn: async (input: {
			videoId: string
			programId: string | null
			timeSeconds: number
			runtimeSeconds: number
		}) => {
			const provider = await getDataProvider()
			return provider.putBookmark(input)
		},
	})

	const latestRef = useRef({ currentTime: 0, duration: 0 })
	latestRef.current = { currentTime, duration }

	const lastSentTimeRef = useRef<number>(Number.NEGATIVE_INFINITY)

	const enabled = !!videoId && assetType === 'vod'

	const flush = (reason: 'periodic' | 'paused' | 'unmount') => {
		if (!enabled || !videoId) return
		const { currentTime: t, duration: d } = latestRef.current
		if (t <= 0 || d <= 0) return

		const progress = t / d
		if (progress >= COMPLETION_THRESHOLD) return

		if (reason === 'periodic' && Math.abs(t - lastSentTimeRef.current) < MIN_DELTA_SECONDS) return

		lastSentTimeRef.current = t
		mutation.mutate({ videoId, programId, timeSeconds: t, runtimeSeconds: Math.floor(d) })
	}

	const flushRef = useRef(flush)
	flushRef.current = flush

	// Resume: GET bookmark → seek when player can. useState (not useRef) so the
	// seek effect re-runs when the async fetch resolves.
	const [resumeAt, setResumeAt] = useState<number | null>(null)
	const hasResumedRef = useRef(false)

	useEffect(() => {
		if (!enabled || !videoId) return
		hasResumedRef.current = false
		setResumeAt(null)
		let cancelled = false
		;(async () => {
			const provider = await getDataProvider()
			const bookmark = await provider.getBookmark(videoId)
			if (cancelled) return
			if (bookmark && bookmark.TimeSeconds > 0) setResumeAt(bookmark.TimeSeconds)
		})()
		return () => {
			cancelled = true
		}
	}, [enabled, videoId])

	useEffect(() => {
		if (!enabled || hasResumedRef.current) return
		if (resumeAt == null || resumeAt <= 0) return
		if (duration <= 0 || !canSeek) return
		hasResumedRef.current = true
		if (resumeAt / duration >= COMPLETION_THRESHOLD) return
		seek(resumeAt)
	}, [enabled, resumeAt, duration, canSeek, seek])

	useEffect(() => {
		if (!enabled || !isPlaying) return
		const id = setInterval(() => flushRef.current('periodic'), PERIODIC_INTERVAL_MS)
		return () => clearInterval(id)
	}, [enabled, isPlaying])

	useEffect(() => {
		if (!enabled || isPlaying) return
		const id = setTimeout(() => flushRef.current('paused'), PAUSED_DEBOUNCE_MS)
		return () => clearTimeout(id)
	}, [enabled, isPlaying])

	useEffect(() => {
		if (!enabled) return
		const onVisibility = () => {
			if (document.visibilityState === 'hidden') flushRef.current('unmount')
		}
		const onBeforeUnload = () => flushRef.current('unmount')
		document.addEventListener('visibilitychange', onVisibility)
		window.addEventListener('beforeunload', onBeforeUnload)
		return () => {
			document.removeEventListener('visibilitychange', onVisibility)
			window.removeEventListener('beforeunload', onBeforeUnload)
			flushRef.current('unmount')
		}
	}, [enabled])
}
