'use client'

import type { MKAudioTrack, MKSubtitleTrack, MKVideoQuality } from '@mediakind/mkplayer'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	type AudioTrackOption,
	type SubtitleCue,
	type SubtitleTrackOption,
	TracksContext,
	type VideoQualityOption,
} from '../context'
import { usePlayer } from '../hooks/use-player'
import { formatAudioTrackLabel, parseFeedKey, resolveSelectedAudioId } from '../utils/audio-tracks'
import type { PlayerRuntime } from '../utils/sdk.web'
import { formatSubtitleTrackLabel } from '../utils/subtitle-labels'

// No mock fallbacks anywhere — every list here is what the SDK reports, or empty.
// An empty list hides its control instead of inventing tracks the stream doesn't have.

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatQualityLabel(q: MKVideoQuality): string {
	if (q.height >= 2160) return '4K'
	if (q.height >= 1080) return `HD ${q.height}p`
	return `${q.height}p`
}

function mapQualities(raw: MKVideoQuality[]): VideoQualityOption[] {
	return raw
		.sort((a, b) => b.height - a.height)
		.map((q) => ({
			id: q.id,
			label: formatQualityLabel(q),
			height: q.height,
			width: q.width,
			bitrate: q.bitrate,
		}))
}

function mapAudioTracks(raw: MKAudioTrack[]): AudioTrackOption[] {
	return raw.map((t) => ({
		id: t.id,
		label: formatAudioTrackLabel(t),
		lang: t.lang,
		feedKey: parseFeedKey(t.label) ?? undefined,
		isAudioDescription: t.role?.some((r) => r.value === 'description') ?? false,
	}))
}

function mapSubtitleTracks(raw: MKSubtitleTrack[]): SubtitleTrackOption[] {
	return raw.map((t) => {
		const label = formatSubtitleTrackLabel(t)
		// SDK labels may already contain "(CC)" — detect to avoid doubling
		const labelHasCC = /\(CC\)/i.test(label)
		return {
			id: t.id,
			label,
			lang: t.lang,
			isCC: !labelHasCC && t.kind === 'caption',
			enabled: t.enabled ?? false,
		}
	})
}

// ── Provider ────────────────────────────────────────────────────────────────

export function TracksProvider({ children }: { children: ReactNode }) {
	const { player } = usePlayer()

	// Guard to skip event-driven refreshes while we're programmatically toggling subtitles
	const subtitleActionInProgress = useRef(false)

	const [videoQualities, setVideoQualities] = useState<VideoQualityOption[]>([])
	const [audioTracks, setAudioTracks] = useState<AudioTrackOption[]>([])
	const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrackOption[]>([])
	const [activeCues, setActiveCues] = useState<SubtitleCue[]>([])
	const [selectedQualityId, setSelectedQualityId] = useState<string | null>(null)
	const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null)
	const [playbackSpeed, setPlaybackSpeed] = useState(1)

	// ── Refresh track lists from SDK ──

	const refreshTracks = useCallback((p: PlayerRuntime, _reason: string) => {
		try {
			// Video qualities
			const rawQualities = p.getAvailableVideoQualities()
			if (rawQualities.length > 0) {
				setVideoQualities(mapQualities(rawQualities))
			} else {
				console.warn('[TRACKS] SDK reported no video qualities — quality menu stays empty')
				setVideoQualities([])
			}

			// Current quality
			try {
				const current = p.getVideoQuality()
				if (current?.id) {
					setSelectedQualityId(current.id)
				}
			} catch (err) {
				console.warn('[TRACKS] getVideoQuality() unsupported', err)
				setSelectedQualityId(null)
			}
		} catch (err) {
			console.warn('[TRACKS] video qualities unavailable', err)
			setVideoQualities([])
		}

		try {
			// Audio tracks
			const rawAudio = p.getAvailableAudio()
			if (rawAudio.length > 0) {
				const mapped = mapAudioTracks(rawAudio)
				setAudioTracks(mapped)
				const currentId = p.getAudio()?.id
				setSelectedAudioId((prev) => resolveSelectedAudioId(mapped, currentId ?? prev))
			} else {
				console.warn('[TRACKS] SDK reported no audio tracks — hiding the audio button')
				setAudioTracks([])
				setSelectedAudioId(null)
			}
		} catch (err) {
			console.warn('[TRACKS] audio tracks unavailable', err)
			setAudioTracks([])
			setSelectedAudioId(null)
		}

		try {
			// Subtitle tracks (subtitles API may be undefined before source loads)
			const rawSubs = p.subtitles?.list() ?? []
			if (rawSubs.length > 0) {
				const mapped = mapSubtitleTracks(rawSubs)
				setSubtitleTracks(mapped)
			} else {
				// No real subtitle tracks — keep the list empty (no mock fallback)
				setSubtitleTracks([])
			}
		} catch (err) {
			console.warn('[TRACKS] subtitle tracks unavailable', err)
			setSubtitleTracks([])
		}

		try {
			const speed = p.getPlaybackSpeed()
			setPlaybackSpeed(speed)
		} catch (err) {
			console.warn('[TRACKS] getPlaybackSpeed() unsupported — assuming 1x', err)
			setPlaybackSpeed(1)
		}
	}, [])

	// ── Subscribe to SDK events ──

	useEffect(() => {
		if (!player) {
			setVideoQualities([])
			setAudioTracks([])
			setSelectedAudioId(null)
			setSubtitleTracks([])
			return
		}

		const p = player as unknown as PlayerRuntime

		const onSourceLoaded = () => refreshTracks(p, 'sourceloaded')

		const onVideoQualityChanged = () => {
			try {
				const current = p.getVideoQuality()
				if (current?.id) {
					setSelectedQualityId(current.id)
				}
			} catch (e) {
				console.warn('[VideoPlayer]', e)
			}
		}

		const onVideoQualityAdded = () => refreshTracks(p, 'videoquality added')

		const onAudioChanged = () => {
			try {
				const current = p.getAudio()
				if (current?.id) {
					setSelectedAudioId(current.id)
				}
			} catch (e) {
				console.warn('[VideoPlayer]', e)
			}
		}

		const onAudioAdded = () => refreshTracks(p, 'audio track added')

		const onSubtitleEnabled = () => {
			if (subtitleActionInProgress.current) return
			try {
				const subs = p.subtitles.list()
				setSubtitleTracks(mapSubtitleTracks(subs))
			} catch (e) {
				console.warn('[VideoPlayer]', e)
			}
		}

		const onSubtitleDisabled = () => {
			if (subtitleActionInProgress.current) return
			try {
				const subs = p.subtitles.list()
				setSubtitleTracks(mapSubtitleTracks(subs))
			} catch (e) {
				console.warn('[VideoPlayer]', e)
			}
		}

		const onSubtitleAdded = () => refreshTracks(p, 'subtitle added')

		// ── Subtitle diagnostics (dev only) ──
		const diagHandlers: { name: string; handler: (...args: unknown[]) => void }[] = []
		if (process.env.NODE_ENV === 'development') {
			const subtitleEvents = [
				'subtitleadded',
				'subtitleremoved',
				'subtitleenabled',
				'subtitledisabled',
				'cueenter',
				'cueexit',
				'cueparsed',
				'cueupdate',
			]
			for (const name of subtitleEvents) {
				const handler = (..._args: unknown[]) => {}
				p.on(name, handler)
				diagHandlers.push({ name, handler })
			}
		}

		// ── Subtitle cue rendering ──
		const onCueEnter = (e: { text?: string; html?: string; start?: number; end?: number }) => {
			const cueId = `${e.start}-${e.end}-${e.text?.slice(0, 20)}`
			const text = e.text ?? ''
			if (!text.trim()) return
			setActiveCues((prev) => {
				// Avoid duplicates
				if (prev.some((c) => c.id === cueId)) return prev
				return [...prev, { id: cueId, text, html: e.html }]
			})
		}

		const onCueExit = (e: { text?: string; start?: number; end?: number }) => {
			const cueId = `${e.start}-${e.end}-${e.text?.slice(0, 20)}`
			setActiveCues((prev) => prev.filter((c) => c.id !== cueId))
		}

		p.on('sourceloaded', onSourceLoaded)
		p.on('videoqualitychanged', onVideoQualityChanged)
		p.on('videoqualityadded', onVideoQualityAdded)
		p.on('audiochanged', onAudioChanged)
		p.on('audioadded', onAudioAdded)
		p.on('subtitleenabled', onSubtitleEnabled)
		p.on('subtitledisabled', onSubtitleDisabled)
		p.on('subtitleadded', onSubtitleAdded)
		p.on('cueenter', onCueEnter as (...args: unknown[]) => void)
		p.on('cueexit', onCueExit as (...args: unknown[]) => void)

		// Initial sync — source may already be loaded
		refreshTracks(p, 'initial sync')

		return () => {
			p.off('sourceloaded', onSourceLoaded)
			p.off('videoqualitychanged', onVideoQualityChanged)
			p.off('videoqualityadded', onVideoQualityAdded)
			p.off('audiochanged', onAudioChanged)
			p.off('audioadded', onAudioAdded)
			p.off('subtitleenabled', onSubtitleEnabled)
			p.off('subtitledisabled', onSubtitleDisabled)
			p.off('subtitleadded', onSubtitleAdded)
			p.off('cueenter', onCueEnter as (...args: unknown[]) => void)
			p.off('cueexit', onCueExit as (...args: unknown[]) => void)
			for (const { name, handler } of diagHandlers) p.off(name, handler)
		}
	}, [player, refreshTracks])

	// ── Actions ──

	const setQuality = useCallback(
		(id: string | null) => {
			if (!player) return
			const p = player as unknown as PlayerRuntime

			if (id === null) {
				setSelectedQualityId(null)
				// SDK doesn't have a direct "auto" toggle — re-setting adaptation config would be needed
				// For now we just clear the selection (ABR resumes on next load)
				return
			}

			try {
				p.setVideoQuality(id)
				setSelectedQualityId(id)
			} catch (e) {
				console.warn('[VideoPlayer]', e)
			}
		},
		[player],
	)

	const setAudioTrack = useCallback(
		(id: string) => {
			if (!player) return
			const p = player as unknown as PlayerRuntime

			try {
				p.setAudio(id)
				setSelectedAudioId(id)
			} catch (e) {
				console.warn('[VideoPlayer]', e)
			}
		},
		[player],
	)

	const enableSubtitle = useCallback(
		(id: string | null) => {
			if (!id) {
				// Turning off
				if (player) {
					const p = player as unknown as PlayerRuntime
					subtitleActionInProgress.current = true
					try {
						const current = p.subtitles?.list()?.filter((s) => s.enabled) ?? []
						for (const s of current) {
							p.subtitles.disable(s.id)
						}
					} catch (e) {
						console.warn('[VideoPlayer]', e)
					}
					subtitleActionInProgress.current = false
				}
				setSubtitleTracks((prev) => prev.map((t) => ({ ...t, enabled: false })))
				setActiveCues([])
				return
			}

			// Real SDK track
			if (!player) return
			const p = player as unknown as PlayerRuntime
			subtitleActionInProgress.current = true
			try {
				p.subtitles.enable(id, true)
				setSubtitleTracks((prev) => prev.map((t) => ({ ...t, enabled: t.id === id })))
			} catch (err) {
				console.warn(`[SUBTITLES] enable(${id}) failed`, err)
			} finally {
				subtitleActionInProgress.current = false
			}
		},
		[player],
	)

	const setSpeed = useCallback(
		(speed: number) => {
			if (!player) return
			const p = player as unknown as PlayerRuntime

			try {
				p.setPlaybackSpeed(speed)
				setPlaybackSpeed(speed)
			} catch (err) {
				console.warn(`[TRACKS] setPlaybackSpeed(${speed}) failed — keeping UI in sync anyway`, err)
				setPlaybackSpeed(speed)
			}
		},
		[player],
	)

	const value = useMemo(
		() => ({
			videoQualities,
			audioTracks,
			subtitleTracks,
			activeCues,
			selectedQualityId,
			selectedAudioId,
			playbackSpeed,
			setQuality,
			setAudioTrack,
			enableSubtitle,
			setSpeed,
		}),
		[
			videoQualities,
			audioTracks,
			subtitleTracks,
			activeCues,
			selectedQualityId,
			selectedAudioId,
			playbackSpeed,
			setQuality,
			setAudioTrack,
			enableSubtitle,
			setSpeed,
		],
	)

	return <TracksContext value={value}>{children}</TracksContext>
}
