'use client'

import type { MKErrorEvent, MKPlayer, MKSourceConfig, MKTweaksConfig } from '@mediakind/mkplayer'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { PlayerContext } from '../context'
import type { PlayerError } from '../types'
import { attemptAutoplay, createPlayer, formatSdkError, type PlayerRuntime, waitForSdk } from '../utils/sdk.web'

type PlayerProviderProps = {
	source: MKSourceConfig
	title?: string
	hlsUrl?: string
	children: ReactNode
	onError?: () => void
	/** SDK tweaks applied at player creation (see `MKTweaksConfig`). */
	tweaks?: MKTweaksConfig
}

type NativePlayerAdapter = {
	on: (event: string, cb: NativeEventHandler) => void
	off: (event: string, cb: NativeEventHandler) => void
	play: () => Promise<void>
	pause: () => void
	seek: (time: number) => boolean
	getDuration: () => number
	getCurrentTime: () => number
	isPlaying: () => boolean
	getVolume: () => number
	setVolume: (value: number) => void
	isMuted: () => boolean
	mute: () => void
	unmute: () => void
	isLive: () => boolean
	getMaxTimeShift: () => number
	getSeekableRange: () => { start: number; end: number }
	getAvailableVideoQualities: () => []
	getVideoQuality: () => { id: string; label: string; height: number; width: number; bitrate: number }
	setVideoQuality: () => void
	getAvailableAudio: () => []
	getAudio: () => null
	setAudio: () => void
	subtitles: {
		list: () => []
		add: () => void
		remove: () => void
		enable: () => void
		disable: () => void
		cueEnter: () => void
		cueExit: () => void
	}
	setPlaybackSpeed: (speed: number) => void
	getPlaybackSpeed: () => number
	getThumbnail: () => null
	getVideoElement: () => HTMLVideoElement
	load: () => Promise<void>
	destroy: () => void
}

type HlsRuntime = {
	loadSource: (url: string) => void
	attachMedia: (video: HTMLVideoElement) => void
	destroy: () => void
}

type HlsConstructor = {
	isSupported: () => boolean
	new (): HlsRuntime
}

type NativeEventHandler = (...args: unknown[]) => void

async function createNativeHlsPlayer(container: HTMLElement, source: MKSourceConfig): Promise<NativePlayerAdapter> {
	const hlsUrl = source.hls
	if (!hlsUrl) throw new Error('Native HLS fallback requires an HLS URL.')

	container.innerHTML = ''

	const video = document.createElement('video')
	video.preload = 'metadata'
	video.playsInline = true
	video.controls = false
	video.crossOrigin = 'anonymous'
	video.style.width = '100%'
	video.style.height = '100%'
	video.style.objectFit = 'contain'
	video.style.backgroundColor = 'black'
	if (source.poster) video.poster = source.poster

	container.appendChild(video)

	const handlers = new Map<string, Set<NativeEventHandler>>()
	const emit = (event: string, payload?: unknown) => {
		for (const handler of handlers.get(event) ?? []) handler(payload)
	}

	let hls: HlsRuntime | null = null
	let playbackSpeed = 1

	const onLoaded = () => {
		emit('sourceloaded')
		emit('durationchanged', { to: adapter.getDuration() })
		emit('stallended')
	}

	video.addEventListener('loadedmetadata', onLoaded)
	video.addEventListener('canplay', () => emit('stallended'))
	video.addEventListener('playing', () => {
		emit('playing')
		emit('stallended')
	})
	video.addEventListener('pause', () => emit('paused'))
	video.addEventListener('waiting', () => emit('stallstarted'))
	video.addEventListener('timeupdate', () => emit('timechanged', { time: video.currentTime }))
	video.addEventListener('durationchange', () => emit('durationchanged', { to: adapter.getDuration() }))
	video.addEventListener('seeked', () => emit('seeked'))
	video.addEventListener('volumechange', () => {
		emit('volumechanged', { targetVolume: adapter.getVolume() })
		emit(video.muted ? 'muted' : 'unmuted')
	})

	const adapter = {
		on(event: string, cb: NativeEventHandler) {
			const set = handlers.get(event) ?? new Set<NativeEventHandler>()
			set.add(cb)
			handlers.set(event, set)
		},
		off(event: string, cb: NativeEventHandler) {
			handlers.get(event)?.delete(cb)
		},
		async play() {
			await video.play()
		},
		pause() {
			video.pause()
		},
		seek(time: number) {
			video.currentTime = Math.max(0, time)
			return true
		},
		getDuration() {
			return Number.isNaN(video.duration) ? 0 : video.duration
		},
		isLive() {
			return source.assetType === 'event' || video.duration === Number.POSITIVE_INFINITY
		},
		getMaxTimeShift() {
			const seekable = video.seekable
			if (seekable.length === 0) return 0
			return Math.max(0, seekable.end(seekable.length - 1) - seekable.start(0))
		},
		getSeekableRange() {
			const seekable = video.seekable
			if (seekable.length === 0) return { start: 0, end: 0 }
			return { start: seekable.start(0), end: seekable.end(seekable.length - 1) }
		},
		getCurrentTime() {
			return video.currentTime || 0
		},
		isPlaying() {
			return !video.paused && !video.ended
		},
		getVolume() {
			return Math.round(video.volume * 100)
		},
		setVolume(value: number) {
			video.volume = Math.max(0, Math.min(1, value / 100))
		},
		isMuted() {
			return video.muted
		},
		mute() {
			video.muted = true
		},
		unmute() {
			video.muted = false
		},
		getAvailableVideoQualities() {
			return []
		},
		getVideoQuality() {
			return { id: 'native-auto', label: 'Auto', height: 0, width: 0, bitrate: 0 }
		},
		setVideoQuality() {},
		getAvailableAudio() {
			return []
		},
		getAudio() {
			return null
		},
		setAudio() {},
		subtitles: {
			list: () => [],
			add: () => {},
			remove: () => {},
			enable: () => {},
			disable: () => {},
			cueEnter: () => {},
			cueExit: () => {},
		},
		setPlaybackSpeed(speed: number) {
			playbackSpeed = speed
			video.playbackRate = speed
		},
		getPlaybackSpeed() {
			return playbackSpeed
		},
		getThumbnail() {
			return null
		},
		getVideoElement() {
			return video
		},
		async load() {},
		destroy() {
			hls?.destroy()
			hls = null
			video.pause()
			video.removeAttribute('src')
			video.load()
			video.remove()
			handlers.clear()
		},
	} satisfies NativePlayerAdapter

	let Hls: HlsConstructor | null = null
	try {
		Hls = (await import('hls.js')).default as unknown as HlsConstructor
	} catch (err) {
		console.warn('[PLAYER] hls.js unavailable — falling back to native playback', err)
		Hls = null
	}

	await new Promise<void>((resolve, reject) => {
		let settled = false
		const settleResolve = () => {
			if (settled) return
			settled = true
			cleanup()
			resolve()
		}
		const settleReject = () => {
			if (settled) return
			settled = true
			cleanup()
			reject(new Error('Native HLS stream failed to load.'))
		}
		const cleanup = () => {
			video.removeEventListener('loadedmetadata', settleResolve)
			video.removeEventListener('canplay', settleResolve)
			video.removeEventListener('error', settleReject)
		}

		video.addEventListener('loadedmetadata', settleResolve)
		video.addEventListener('canplay', settleResolve)
		video.addEventListener('error', settleReject)

		if (Hls?.isSupported()) {
			hls = new Hls()
			hls.loadSource(hlsUrl)
			hls.attachMedia(video)
			return
		}

		if (video.canPlayType('application/vnd.apple.mpegurl')) {
			video.src = hlsUrl
			video.load()
			return
		}

		settleReject()
	})

	onLoaded()

	return adapter
}

export function PlayerProvider({ source, title, hlsUrl, onError, tweaks, children }: PlayerProviderProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const wrapperRef = useRef<HTMLDivElement>(null)
	const [player, setPlayer] = useState<MKPlayer | null>(null)
	const [error, setError] = useState<PlayerError | null>(null)
	const onErrorRef = useRef(onError)
	onErrorRef.current = onError

	// Stabilise `source` so the effect only re-runs when the actual content changes
	const sourceKey = JSON.stringify(source)
	// Same for the tweaks: callers pass an object literal, which is a new reference every render.
	const tweaksKey = JSON.stringify(tweaks ?? null)

	useEffect(() => {
		const container = containerRef.current
		if (!container) return
		const playerContainer = container

		let cancelled = false
		let instance: MKPlayer | null = null
		let nativeInstance: NativePlayerAdapter | null = null
		const src: MKSourceConfig = JSON.parse(sourceKey)
		const sdkTweaks: MKTweaksConfig | undefined = JSON.parse(tweaksKey) ?? undefined

		async function initPlayer() {
			const directHlsUrl = src.hls ?? (!src.registered ? hlsUrl : undefined)

			console.log('[PLAYBACK] PlayerProvider initPlayer', {
				hasRegistered: !!src.registered,
				srcHls: src.hls,
				hlsUrlProp: hlsUrl,
				directHlsUrlResolved: directHlsUrl,
				branch: directHlsUrl ? 'NATIVE_HLS' : 'SDK_REGISTERED',
			})

			if (directHlsUrl) {
				console.log(
					'[PLAYBACK] → NATIVE HLS branch (SDK bypassed) — no libraryItem/bookmark/AMP/license/clientRoll calls will be made',
					{
						url: directHlsUrl,
						isHttp: directHlsUrl.startsWith('http://'),
					},
				)
				if (
					directHlsUrl.startsWith('http://') &&
					typeof window !== 'undefined' &&
					window.location.protocol === 'https:'
				) {
					console.error(
						'[PLAYBACK] MIXED CONTENT: page is HTTPS but stream URL is HTTP — browser will block this request',
					)
				}
				try {
					nativeInstance = await createNativeHlsPlayer(playerContainer, {
						title: title ?? src.title ?? 'Video',
						...(src.assetType ? { assetType: src.assetType } : {}),
						...(src.poster ? { poster: src.poster } : {}),
						hls: directHlsUrl,
					})
					if (cancelled) {
						nativeInstance.destroy()
						nativeInstance = null
						return
					}
					console.log('[PLAYBACK] NATIVE HLS player created successfully')
					setPlayer(nativeInstance as unknown as MKPlayer)
					void attemptAutoplay(nativeInstance)
				} catch (err) {
					if (cancelled) return
					console.error('[PLAYBACK] NATIVE HLS player FAILED to load', err)
					setError({ title: 'Playback failed', description: formatSdkError(err) || 'Unable to load this video.' })
				}
				return
			}

			console.log('[PLAYBACK] → SDK REGISTERED branch — waiting for mkplayer.js')
			try {
				await waitForSdk()
				console.log(
					'[PLAYBACK] mkplayer SDK is loaded, window.mkplayer =',
					typeof window !== 'undefined' ? (window as unknown as { mkplayer?: unknown }).mkplayer : 'n/a',
				)
			} catch (err) {
				if (cancelled) return
				console.error('[PLAYBACK] mkplayer.js failed to load within timeout', err)
				setError({ title: 'MKPlayer SDK not loaded', description: 'Check that mkplayer.js is included.' })
				return
			}

			if (cancelled) return

			try {
				instance = createPlayer(playerContainer, sdkTweaks)
				console.log('[PLAYBACK] SDK player instance created')

				if (cancelled) {
					instance.destroy()
					instance = null
					return
				}
				setPlayer(instance)

				const sourceConfig: MKSourceConfig = {
					title: title ?? src.title ?? 'Video',
					...(src.assetType ? { assetType: src.assetType } : {}),
					...(src.poster ? { poster: src.poster } : {}),
				}

				if (src.registered) {
					sourceConfig.registered = src.registered

					// Catch-all error logger for the SDK — surfaces every error code so we can
					// see why registered mode never makes its follow-up calls.
					;(instance as unknown as PlayerRuntime).on('mkerror', (event: unknown) => {
						const e = event as MKErrorEvent
						console.error('[PLAYBACK] SDK mkerror event', {
							code: e.code,
							name: (e as unknown as { name?: string }).name,
							message: (e as unknown as { message?: string }).message,
							data: (e as unknown as { data?: unknown }).data,
							raw: event,
						})
					})
					;(instance as unknown as PlayerRuntime).on('mkwarning', (event: unknown) => {
						console.warn('[PLAYBACK] SDK mkwarning event', event)
					})
					;(instance as unknown as PlayerRuntime).on('mksourceloaded', (event: unknown) => {
						console.log('[PLAYBACK] SDK mksourceloaded — source accepted', event)
					})
					;(instance as unknown as PlayerRuntime).on('mkready', (event: unknown) => {
						console.log('[PLAYBACK] SDK mkready', event)
					})

					// When AMP is geo-blocked, fall back to direct HLS stream
					if (hlsUrl) {
						let falledBack = false
						;(instance as unknown as PlayerRuntime).on('mkerror', async (event: unknown) => {
							if (cancelled) return
							const e = event as MKErrorEvent
							if (e.code === '4-71-1204' && !falledBack) {
								console.warn('[PLAYBACK] AMP geo-block (4-71-1204) → falling back to direct HLS')
								falledBack = true
								try {
									const fallbackSource: MKSourceConfig = {
										title: sourceConfig.title,
										assetType: sourceConfig.assetType,
										poster: sourceConfig.poster,
										hls: hlsUrl,
									}
									instance?.destroy()
									instance = null
									nativeInstance = await createNativeHlsPlayer(playerContainer, fallbackSource)
									if (cancelled) {
										nativeInstance.destroy()
										nativeInstance = null
										return
									}
									setPlayer(nativeInstance as unknown as MKPlayer)
									void attemptAutoplay(nativeInstance)
								} catch (fallbackErr) {
									if (cancelled) return
									console.error('[PLAYBACK] geo-block fallback to native HLS FAILED', fallbackErr)
									setError({ title: 'Stream unavailable', description: 'Stream unavailable in this region' })
								}
							}
						})
					}
				} else if (src.hls) {
					sourceConfig.hls = src.hls
				} else if (hlsUrl) {
					sourceConfig.hls = hlsUrl
				}

				console.log('[PLAYBACK] SDK calling instance.load(sourceConfig)', {
					hasRegistered: !!sourceConfig.registered,
					hasHls: !!sourceConfig.hls,
					registered: sourceConfig.registered,
				})

				await instance.load(sourceConfig)
				console.log('[PLAYBACK] SDK instance.load() resolved successfully')
				if (cancelled) return
				void attemptAutoplay(instance as unknown as PlayerRuntime)
			} catch (err) {
				if (cancelled) return
				console.error('[PLAYBACK] SDK instance.load() THREW', {
					error: err,
					message: formatSdkError(err),
				})
				if (hlsUrl) {
					console.warn('[PLAYBACK] attempting native HLS fallback because SDK load threw', { hlsUrl })
					try {
						instance?.destroy()
						instance = null
						nativeInstance = await createNativeHlsPlayer(playerContainer, {
							title: title ?? src.title ?? 'Video',
							...(src.assetType ? { assetType: src.assetType } : {}),
							...(src.poster ? { poster: src.poster } : {}),
							hls: hlsUrl,
						})
						if (cancelled) {
							nativeInstance.destroy()
							nativeInstance = null
							return
						}
						console.log('[PLAYBACK] native HLS fallback succeeded after SDK load failure')
						setPlayer(nativeInstance as unknown as MKPlayer)
						void attemptAutoplay(nativeInstance)
						return
					} catch (fallbackErr) {
						console.error('[PLAYBACK] native HLS fallback ALSO FAILED', fallbackErr)
					}
				}
				const msg = formatSdkError(err)
				setError({ title: 'Playback failed', description: msg || 'Unable to load this video.' })
			}
		}

		initPlayer()

		return () => {
			cancelled = true
			try {
				instance?.destroy()
			} catch (err) {
				console.warn('[PLAYER] destroy() failed on unmount', err)
			}
			try {
				nativeInstance?.destroy()
			} catch (err) {
				console.warn('[PLAYER] native destroy() failed on unmount', err)
			}
			instance = null
			nativeInstance = null
			setPlayer(null)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sourceKey, tweaksKey, title, hlsUrl])

	useEffect(() => {
		if (error) {
			console.error('[PLAYBACK] PlayerProvider error state set → calling onError', error)
			onErrorRef.current?.()
		}
	}, [error])

	const value = useMemo(() => ({ player, containerRef, wrapperRef, error }), [player, error])

	return (
		<PlayerContext value={value}>
			<div ref={wrapperRef} data-player-container className='relative h-full w-full overflow-hidden bg-black'>
				<style>{`
					[data-player-container] .bitmovinplayer-poster { background-size: cover !important; }
					[data-player-container] video { width: 100% !important; height: 100% !important; object-fit: contain; }
					[data-player-container] button:focus-visible {
						outline: none;
						box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
						border-radius: inherit;
					}
					[data-player-container]:fullscreen,
					[data-player-container]:-webkit-full-screen {
						border-radius: 0;
						width: 100vw;
						height: 100vh;
						background: black;
					}
					[data-player-container]:fullscreen > div:nth-child(2),
					[data-player-container]:-webkit-full-screen > div:nth-child(2) {
						aspect-ratio: auto;
						width: 100%;
						height: 100%;
					}
				`}</style>
				<div ref={containerRef} className='pointer-events-none absolute inset-0 overflow-hidden' />
				{children}
			</div>
		</PlayerContext>
	)
}
