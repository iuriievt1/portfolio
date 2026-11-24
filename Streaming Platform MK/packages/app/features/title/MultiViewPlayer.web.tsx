'use client'

import type { MKPlayerConfig, MKSourceConfig } from '@mediakind/mkplayer'
import {
	BackIcon,
	CollapseIcon,
	ExpandIcon,
	MuteIcon,
	PauseIcon,
	PlayIcon,
	VolumeIcon,
} from '@pkg/design-system/icons/VideoPlayer'
import { cn } from '@pkg/utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSafeBack } from './use-safe-back'

declare const mkplayer:
	| {
			MKPlayer: new (container: HTMLElement, config: MKPlayerConfig) => PlayerRuntime
	  }
	| undefined

type PlayerRuntime = {
	on: (event: string, callback: (...args: unknown[]) => void) => void
	off: (event: string, callback: (...args: unknown[]) => void) => void
	play: (issuer?: string) => Promise<void>
	pause: (issuer?: string) => void
	mute: (issuer?: string) => void
	unmute: (issuer?: string) => void
	setVolume: (value: number, issuer?: string) => void
	getCurrentTime: () => number
	getDuration: () => number
	isLive: () => boolean
	seek: (time: number, issuer?: string) => boolean | undefined
	load: (source: MKSourceConfig) => Promise<void>
	destroy: () => Promise<void> | void
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

type PlayerLikeError = {
	code?: string
	message?: string
	name?: string
}

export type MultiViewStream = {
	id: string
	label: string
	subtitle: string
	poster: string
	hlsUrl?: string
	mediaId?: string
	offerId?: string
	serverUrl?: string
	authToken?: string
	ownerUid?: string
	assetType?: MKSourceConfig['assetType']
	isLive?: boolean
}

export type MultiViewConfig = {
	id: string
	title: string
	count: 2 | 3 | 4
	streams: MultiViewStream[]
}

type ViewMode = 'grid' | 'focused' | 'single'

function waitForSdk(timeoutMs = 10_000): Promise<void> {
	if (typeof mkplayer !== 'undefined') return Promise.resolve()

	return new Promise((resolve, reject) => {
		const start = Date.now()
		const check = () => {
			if (typeof mkplayer !== 'undefined') return resolve()
			if (Date.now() - start > timeoutMs) return reject(new Error('MKPlayer SDK did not load within timeout'))
			setTimeout(check, 100)
		}
		check()
	})
}

function createPlayer(container: HTMLElement, muted: boolean): PlayerRuntime {
	if (typeof mkplayer === 'undefined') throw new Error('MKPlayer SDK not loaded')

	return new mkplayer.MKPlayer(container, {
		key: process.env.NEXT_PUBLIC_MKPLAYER_KEY ?? '',
		ui: false,
		log: { level: 'off' as NonNullable<MKPlayerConfig['log']>['level'] },
		enableSubtitleOverlay: false,
		playback: {
			autoplay: false,
			muted,
		},
	}) as unknown as PlayerRuntime
}

async function createNativeHlsPlayer(
	container: HTMLElement,
	source: MKSourceConfig,
	muted: boolean,
): Promise<PlayerRuntime> {
	const hlsUrl = source.hls
	if (!hlsUrl) throw new Error('Native HLS playback requires an HLS URL.')

	container.innerHTML = ''

	const video = document.createElement('video')
	video.preload = 'metadata'
	video.playsInline = true
	video.controls = false
	video.crossOrigin = 'anonymous'
	video.muted = muted
	video.style.width = '100%'
	video.style.height = '100%'
	video.style.objectFit = 'cover'
	video.style.backgroundColor = 'black'
	if (source.poster) video.poster = source.poster

	container.appendChild(video)

	const handlers = new Map<string, Set<(...args: unknown[]) => void>>()
	const emit = (event: string, payload?: unknown) => {
		for (const handler of handlers.get(event) ?? []) handler(payload)
	}

	let hls: HlsRuntime | null = null
	const adapter: PlayerRuntime = {
		on(event, callback) {
			const set = handlers.get(event) ?? new Set<(...args: unknown[]) => void>()
			set.add(callback)
			handlers.set(event, set)
		},
		off(event, callback) {
			handlers.get(event)?.delete(callback)
		},
		async play() {
			await video.play()
		},
		pause() {
			video.pause()
		},
		mute() {
			video.muted = true
		},
		unmute() {
			video.muted = false
		},
		setVolume(value) {
			video.volume = Math.max(0, Math.min(1, value <= 1 ? value : value / 100))
		},
		getCurrentTime() {
			return video.currentTime || 0
		},
		getDuration() {
			return Number.isFinite(video.duration) ? video.duration : 0
		},
		isLive() {
			return false
		},
		seek(time) {
			video.currentTime = Math.max(0, time)
			return true
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
	}

	const onLoaded = () => {
		emit('sourceloaded')
		emit('durationchanged', { to: adapter.getDuration() })
	}

	video.addEventListener('loadedmetadata', onLoaded)
	video.addEventListener('durationchange', () => emit('durationchanged', { to: adapter.getDuration() }))
	video.addEventListener('timeupdate', () => emit('timechanged', { time: video.currentTime }))
	video.addEventListener('playing', () => emit('playing'))
	video.addEventListener('pause', () => emit('paused'))

	let Hls: HlsConstructor | null = null
	try {
		Hls = (await import('hls.js')).default as unknown as HlsConstructor
	} catch (err) {
		console.warn('[MULTIVIEW] hls.js unavailable — falling back to native playback', err)
		Hls = null
	}

	await new Promise<void>((resolve, reject) => {
		let settled = false
		const settle = (ok: boolean) => {
			if (settled) return
			settled = true
			cleanup()
			if (ok) {
				resolve()
			} else {
				reject(new Error('Native HLS stream failed to load.'))
			}
		}
		const cleanup = () => {
			video.removeEventListener('loadedmetadata', settleOk)
			video.removeEventListener('canplay', settleOk)
			video.removeEventListener('error', settleError)
		}
		const settleOk = () => settle(true)
		const settleError = () => settle(false)

		video.addEventListener('loadedmetadata', settleOk)
		video.addEventListener('canplay', settleOk)
		video.addEventListener('error', settleError)

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

		settleError()
	})

	onLoaded()
	return adapter
}

function sourceForStream(stream: MultiViewStream): MKSourceConfig {
	const source: MKSourceConfig = {
		title: stream.label,
		...(stream.poster ? { poster: stream.poster } : {}),
		...(stream.assetType ? { assetType: stream.assetType } : {}),
	}

	if (stream.mediaId && stream.serverUrl && stream.authToken) {
		return {
			...source,
			registered: {
				mediaId: stream.mediaId,
				offerId: stream.offerId,
				environmentConfig: {
					serverUrl: stream.serverUrl,
					authToken: stream.authToken,
					ownerUid: stream.ownerUid,
				},
			},
		}
	}

	if (stream.hlsUrl) return { ...source, hls: stream.hlsUrl }
	return source
}

function hlsSourceForUrl(hlsUrl: string | undefined, source: MKSourceConfig): MKSourceConfig | null {
	if (!hlsUrl) return null
	return {
		title: source.title,
		...(source.poster ? { poster: source.poster } : {}),
		hls: hlsUrl,
	}
}

function isUnsupportedStreamError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false
	const e = error as PlayerLikeError
	const text = [e.code, e.name, e.message].filter(Boolean).join(' ')
	return /1204|SOURCE_STREAM_TYPE_NOT_SUPPORTED|Source type not supported/i.test(text)
}

function PlaybackUnavailable({ title = 'Multi View' }: { title?: string }) {
	const handleBack = useSafeBack()

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black text-white'>
			<button
				type='button'
				onClick={handleBack}
				className='absolute top-6 right-6 font-light text-3xl text-white/80 transition-opacity hover:text-white'
				aria-label='Close'
			>
				&times;
			</button>
			<div className='flex max-w-md flex-col items-center gap-6 px-6 text-center'>
				<div className='flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-400'>
					<span className='font-bold text-2xl text-red-400'>!</span>
				</div>
				<h2 className='font-bold text-xl md:text-2xl'>Playback Unavailable</h2>
				<p className='text-sm text-white/70 md:text-base'>{title} is not available for multiview playback right now.</p>
				<button
					type='button'
					onClick={handleBack}
					className='w-full rounded-lg bg-white px-8 py-3 font-semibold text-black text-sm transition-opacity hover:opacity-90 md:text-base'
				>
					Go Back
				</button>
			</div>
		</div>
	)
}

function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins}:${secs.toString().padStart(2, '0')}`
}

function streamIsLive(stream: MultiViewStream | undefined): boolean {
	const assetType = String(stream?.assetType ?? '').toLowerCase()
	return stream?.isLive === true || assetType === 'event' || assetType === 'live'
}

function syncPlayerTime(player: PlayerRuntime, time: number) {
	if (!Number.isFinite(time) || time <= 0) return

	const duration = player.getDuration()
	if (!Number.isFinite(duration) || duration <= 0 || player.isLive()) return
	player.seek(Math.min(time, Math.max(duration - 0.2, 0)))
}

function layoutClass(count: MultiViewConfig['count']): string {
	if (count === 2) return 'grid-cols-2'
	if (count === 3) return 'grid-cols-[minmax(0,2.058fr)_minmax(0,1fr)] grid-rows-2'
	return 'grid-cols-2 grid-rows-2'
}

function tileClass(count: MultiViewConfig['count'], streamId: string, activeId: string): string {
	if (count === 3 && streamId === activeId) return 'row-span-2'
	return ''
}

type VideoTileProps = {
	stream: MultiViewStream
	active: boolean
	count: MultiViewConfig['count']
	activeId: string
	playing: boolean
	muted: boolean
	chromeVisible: boolean
	showLabels: boolean
	showActiveBorder?: boolean
	className?: string
	useGridSpan?: boolean
	onSelect: (id: string) => void
	register: (id: string, player: PlayerRuntime | null) => void
}

function VideoTile({
	stream,
	active,
	count,
	activeId,
	playing,
	muted,
	chromeVisible,
	showLabels,
	showActiveBorder = true,
	className,
	useGridSpan = true,
	onSelect,
	register,
}: VideoTileProps) {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const playerRef = useRef<PlayerRuntime | null>(null)
	const mutedRef = useRef(muted)
	const playingRef = useRef(playing)
	const [error, setError] = useState<string | null>(null)
	const sourceKey = JSON.stringify(sourceForStream(stream))
	const fallbackHlsUrl = stream.hlsUrl

	useEffect(() => {
		mutedRef.current = muted
	}, [muted])

	useEffect(() => {
		playingRef.current = playing
	}, [playing])

	useEffect(() => {
		const container = containerRef.current
		if (!container) return
		const containerElement = container

		let cancelled = false
		let player: PlayerRuntime | null = null
		const source = JSON.parse(sourceKey) as MKSourceConfig
		let didFallbackToHls = false
		let handlePlayerError: ((event: unknown) => void) | null = null

		async function loadHlsFallback(reason: unknown): Promise<boolean> {
			if (didFallbackToHls || !isUnsupportedStreamError(reason)) return false

			const fallbackSource = hlsSourceForUrl(fallbackHlsUrl, source)
			if (!fallbackSource || !player) return false

			didFallbackToHls = true
			try {
				await Promise.resolve(player.destroy())
				player = await createNativeHlsPlayer(containerElement, fallbackSource, mutedRef.current)
				playerRef.current = player
				register(stream.id, player)
				if (cancelled) return true
				setError(null)
				if (playingRef.current) await player.play('multiview')
				return true
			} catch (err) {
				console.warn('[MULTIVIEW] stream load failed', err)
				if (!cancelled) setError('Video unavailable')
				return true
			}
		}

		async function init() {
			try {
				if (source.hls && !stream.mediaId) {
					player = await createNativeHlsPlayer(containerElement, source, mutedRef.current)
					if (cancelled) {
						await Promise.resolve(player.destroy())
						return
					}
					playerRef.current = player
					register(stream.id, player)
					setError(null)
					if (playingRef.current) await player.play('multiview')
					return
				}

				await waitForSdk()
				if (cancelled || !container) return

				player = createPlayer(container, mutedRef.current)
				playerRef.current = player
				register(stream.id, player)
				handlePlayerError = (event: unknown) => {
					void loadHlsFallback(event).then((handled) => {
						if (!cancelled && !handled) setError('Video unavailable')
					})
				}
				player.on('mkerror', handlePlayerError)

				if (mutedRef.current) {
					player.mute('multiview')
				} else {
					player.unmute('multiview')
				}

				try {
					await player.load(source)
				} catch (err) {
					console.warn('[Multiview] load() failed, trying HLS fallback', { streamId: stream.id, err })
					const handled = await loadHlsFallback(err)
					if (!handled) throw err
					console.warn('[Multiview] HLS fallback engaged', { streamId: stream.id })
				}
				if (cancelled) return
				setError(null)
				if (playingRef.current) await player.play('multiview')
			} catch (err) {
				console.warn('[MULTIVIEW] player setup failed', err)
				if (!cancelled) setError('Video unavailable')
			}
		}

		void init()

		return () => {
			cancelled = true
			if (player && handlePlayerError) player.off('mkerror', handlePlayerError)
			register(stream.id, null)
			playerRef.current = null
			void Promise.resolve(player?.destroy()).catch((err) =>
				console.warn('[Multiview] Player destroy failed on cleanup', { streamId: stream.id, err }),
			)
		}
	}, [sourceKey, stream.id, stream.mediaId, fallbackHlsUrl, register])

	useEffect(() => {
		const player = playerRef.current
		if (!player) return

		if (muted) {
			player.mute('multiview')
		} else {
			player.unmute('multiview')
			player.setVolume(1, 'multiview')
		}
	}, [muted])

	useEffect(() => {
		const player = playerRef.current
		if (!player) return

		if (playing) {
			void player
				.play('multiview')
				.catch((err) => console.warn('[Multiview] play() rejected', { streamId: stream.id, err }))
		} else {
			player.pause('multiview')
		}
	}, [playing])

	return (
		<button
			type='button'
			data-multiview-tile
			onClick={() => onSelect(stream.id)}
			className={cn(
				'group relative min-h-0 overflow-hidden rounded-[4px] bg-black text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-white',
				useGridSpan && tileClass(count, stream.id, activeId),
				className,
			)}
			aria-label={`Select ${stream.label}`}
		>
			{stream.poster && <img src={stream.poster} alt='' className='absolute inset-0 h-full w-full object-cover' />}
			<div ref={containerRef} className='absolute inset-0' />
			{error && (
				<div className='absolute inset-0 z-10 flex items-center justify-center bg-black text-sm text-white/55'>
					{error}
				</div>
			)}
			<div
				className={cn(
					'absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/75 to-transparent p-3 transition-opacity duration-200',
					chromeVisible && showLabels ? 'opacity-100' : 'opacity-0',
				)}
			>
				<div className='flex items-end justify-between gap-3'>
					<div className='min-w-0'>
						<p className='truncate font-semibold text-sm text-white'>{stream.label}</p>
						<p className='truncate text-white/60 text-xs'>{stream.subtitle}</p>
					</div>
				</div>
			</div>
			{active && showActiveBorder && (
				<div className='pointer-events-none absolute inset-0 z-30 rounded-[4px] ring-2 ring-white ring-inset' />
			)}
		</button>
	)
}

export function MultiViewPlayer({ id: _id, config }: { id: string; config?: MultiViewConfig | null }) {
	if (!config || config.streams.length < 2) return <PlaybackUnavailable title={config?.title} />

	return <MultiViewPlayback config={config} />
}

function MultiViewPlayback({ config }: { config: MultiViewConfig }) {
	const handleBack = useSafeBack()
	const wrapperRef = useRef<HTMLDivElement>(null)
	const playerRefs = useRef<Record<string, PlayerRuntime | null>>({})
	const hideControlsRef = useRef<ReturnType<typeof setTimeout>>(undefined)
	const lastTimeRef = useRef(0)
	const activeIdRef = useRef(config.streams[0]?.id ?? 'main')
	const mutedRef = useRef(false)
	const playingRef = useRef(false)
	const [activeId, setActiveId] = useState(config.streams[0]?.id ?? 'main')
	const [viewMode, setViewMode] = useState<ViewMode>('grid')
	const [playing, setPlaying] = useState(false)
	const [muted, setMuted] = useState(false)
	const [duration, setDuration] = useState(0)
	const [currentTime, setCurrentTime] = useState(0)
	const [controlsVisible, setControlsVisible] = useState(true)
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [isLiveStream, setIsLiveStream] = useState(() => streamIsLive(config.streams[0]))

	const progress = !isLiveStream && duration > 0 ? Math.min(currentTime / duration, 1) : 0
	const streams = useMemo(() => config.streams, [config.streams])
	const activeStream = streams.find((stream) => stream.id === activeId) ?? streams[0]
	const secondaryStreams = streams.filter((stream) => stream.id !== activeStream?.id)
	const gridStreams = config.count === 3 && activeStream ? [activeStream, ...secondaryStreams] : streams
	const controlsBelowGrid = viewMode === 'grid' && config.count === 3
	const showGridGradient = controlsVisible && viewMode === 'grid' && config.count === 4

	useEffect(() => {
		activeIdRef.current = activeId
	}, [activeId])

	useEffect(() => {
		mutedRef.current = muted
	}, [muted])

	useEffect(() => {
		playingRef.current = playing
	}, [playing])

	useEffect(() => {
		const firstStream = config.streams[0]
		setActiveId(firstStream?.id ?? 'main')
		setViewMode('grid')
		setPlaying(false)
		setDuration(0)
		setCurrentTime(0)
		setIsLiveStream(streamIsLive(firstStream))
		for (const stream of config.streams) playerRefs.current[stream.id]?.pause('multiview')
	}, [config])

	const registerPlayer = useCallback((streamId: string, player: PlayerRuntime | null) => {
		playerRefs.current[streamId] = player
		if (!player) return

		if (mutedRef.current || streamId !== activeIdRef.current) {
			player.mute('multiview')
		} else {
			player.unmute('multiview')
		}
		syncPlayerTime(player, lastTimeRef.current)
		if (playingRef.current)
			void player.play('multiview').catch((err) => console.warn('[Multiview] play() rejected on unmute', err))
	}, [])

	useEffect(() => {
		for (const stream of streams) {
			const player = playerRefs.current[stream.id]
			if (!player) continue
			if (muted || stream.id !== activeId) {
				player.mute('multiview')
			} else {
				player.unmute('multiview')
				player.setVolume(1, 'multiview')
			}
		}
	}, [activeId, muted, streams])

	useEffect(() => {
		const active = playerRefs.current[activeId]
		if (!active) return

		const syncTime = () => {
			const time = active.getCurrentTime()
			lastTimeRef.current = time
			setCurrentTime(time)
		}
		const syncDuration = () => {
			const live = streamIsLive(activeStream) || active.isLive()
			setIsLiveStream(live)
			setDuration(live ? 0 : active.getDuration())
		}
		active.on('timechanged', syncTime)
		active.on('durationchanged', syncDuration)
		active.on('sourceloaded', syncDuration)
		syncDuration()
		syncTime()

		return () => {
			active.off('timechanged', syncTime)
			active.off('durationchanged', syncDuration)
			active.off('sourceloaded', syncDuration)
		}
	}, [activeId, activeStream])

	useEffect(() => {
		const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === wrapperRef.current)
		document.addEventListener('fullscreenchange', onFullscreenChange)
		return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
	}, [])

	useEffect(() => () => clearTimeout(hideControlsRef.current), [])

	function scheduleControlsHide() {
		clearTimeout(hideControlsRef.current)
		if (!playingRef.current) return
		hideControlsRef.current = setTimeout(() => setControlsVisible(false), 2500)
	}

	function showControls() {
		setControlsVisible(true)
		scheduleControlsHide()
	}

	async function playAll() {
		setPlaying(true)
		setControlsVisible(true)
		clearTimeout(hideControlsRef.current)
		hideControlsRef.current = setTimeout(() => setControlsVisible(false), 2500)
		await Promise.allSettled(
			streams.map((stream) => {
				const player = playerRefs.current[stream.id]
				if (!player) return undefined
				if (muted || stream.id !== activeId) player.mute('multiview')
				return player.play('multiview')
			}),
		)
	}

	function pauseAll() {
		setPlaying(false)
		setControlsVisible(true)
		clearTimeout(hideControlsRef.current)
		for (const stream of streams) playerRefs.current[stream.id]?.pause('multiview')
	}

	function togglePlayback() {
		if (playing) {
			pauseAll()
		} else {
			void playAll()
		}
	}

	function selectStream(streamId: string) {
		const previous = playerRefs.current[activeId]
		const next = playerRefs.current[streamId]
		if (previous) {
			lastTimeRef.current = previous.getCurrentTime()
			if (next) syncPlayerTime(next, lastTimeRef.current)
		}
		setActiveId(streamId)
		showControls()
		if (playing)
			void next
				?.play('multiview')
				.catch((err) => console.warn('[Multiview] play() rejected on tile switch', { streamId, err }))
	}

	function handleTileSelect(streamId: string) {
		if (viewMode === 'single') return

		// Every tile opens single-view, including the one that was already active (#66).
		selectStream(streamId)
		setViewMode('single')
	}

	function handleBackClick() {
		if (viewMode === 'single') {
			setViewMode('grid')
			showControls()
			return
		}

		handleBack()
	}

	function seek(value: number) {
		if (isLiveStream || duration <= 0) return

		const time = (duration * value) / 100
		for (const stream of streams) {
			const player = playerRefs.current[stream.id]
			if (player && !player.isLive()) syncPlayerTime(player, time)
		}
		setCurrentTime(time)
	}

	function toggleFullscreen() {
		if (document.fullscreenElement) {
			void document.exitFullscreen()
		} else {
			void wrapperRef.current?.requestFullscreen()
		}
	}

	const controls = (
		<div
			className={cn('pointer-events-auto relative z-50 py-2', controlsBelowGrid ? 'space-y-1' : 'space-y-4')}
			onMouseEnter={showControls}
			onPointerDown={showControls}
		>
			<div className='flex items-center gap-4'>
				<input
					type='range'
					min={0}
					max={100}
					value={Math.round(progress * 100)}
					onChange={(event) => seek(Number(event.currentTarget.value))}
					disabled={isLiveStream || duration <= 0}
					className='h-1 flex-1 accent-white disabled:opacity-40'
					aria-label='Seek'
				/>
				<span className='min-w-[42px] text-right font-semibold text-white/85 text-xs'>
					{isLiveStream || duration <= 0 ? 'LIVE' : formatTime(duration)}
				</span>
			</div>
			<div className='flex items-center justify-between'>
				<div className='flex items-center gap-3'>
					<button
						type='button'
						onClick={togglePlayback}
						className='flex h-12 w-12 touch-manipulation items-center justify-center rounded-full bg-black/40 transition-colors hover:bg-white/15'
						aria-label={playing ? 'Pause' : 'Play'}
					>
						{playing ? <PauseIcon className='h-4 w-4' /> : <PlayIcon className='h-4 w-4' />}
					</button>
					<button
						type='button'
						onClick={() => setMuted((value) => !value)}
						className='flex h-12 w-12 touch-manipulation items-center justify-center rounded-full bg-black/40 transition-colors hover:bg-white/15'
						aria-label={muted ? 'Unmute' : 'Mute'}
					>
						{muted ? <MuteIcon className='h-4 w-4' /> : <VolumeIcon className='h-4 w-4' />}
					</button>
					<span className='text-white/60 text-xs'>{formatTime(currentTime)}</span>
				</div>
				<button
					type='button'
					onClick={toggleFullscreen}
					className='flex h-12 w-12 touch-manipulation items-center justify-center rounded-full bg-black/40 transition-colors hover:bg-white/15'
					aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
				>
					{isFullscreen ? <CollapseIcon className='h-4 w-4' /> : <ExpandIcon className='h-4 w-4' />}
				</button>
			</div>
		</div>
	)

	return (
		<div
			ref={wrapperRef}
			className='fixed inset-0 z-50 bg-black text-white'
			onMouseMove={showControls}
			onFocus={showControls}
		>
			<style>{`
				[data-multiview-tile] video {
					width: 100% !important;
					height: 100% !important;
					object-fit: cover !important;
				}

				[data-multiview-tile] .bitmovinplayer-poster {
					background-size: cover !important;
				}
			`}</style>
			<div
				className={cn(
					'h-full w-full',
					viewMode === 'single'
						? 'p-0'
						: controlsBelowGrid
							? cn(
									'flex flex-col items-center justify-center',
									isFullscreen ? 'px-8 pt-16 pb-8' : 'px-1.5 pt-[clamp(48px,8vh,80px)] pb-[clamp(16px,5vh,56px)]',
								)
							: 'p-4 sm:p-8',
				)}
			>
				{viewMode === 'grid' && config.count === 3 && (
					<div
						className={cn(
							isFullscreen ? 'w-[min(1600px,calc(100vw-64px))] max-w-none translate-y-4' : 'w-full max-w-none',
						)}
					>
						<div
							className={cn(
								'mb-4 flex translate-y-1.5 items-center justify-between transition-opacity duration-200',
								controlsVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
							)}
						>
							<button
								type='button'
								onClick={handleBackClick}
								className='pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/35 transition-colors hover:bg-white/15'
								aria-label='Back'
							>
								<BackIcon className='h-4 w-5' />
							</button>
							<div className='rounded-full bg-black/35 px-3 py-1.5 font-semibold text-white/80 text-xs'>
								Multiview x{config.count}
							</div>
						</div>
						<div
							className={cn('grid aspect-[1257/432] w-full gap-x-3 gap-y-[13px] bg-black', layoutClass(config.count))}
						>
							{gridStreams.map((stream) => (
								<VideoTile
									key={stream.id}
									stream={stream}
									active={stream.id === activeId}
									count={config.count}
									activeId={activeId}
									playing={playing}
									muted={muted || stream.id !== activeId}
									chromeVisible={controlsVisible}
									showLabels={false}
									onSelect={handleTileSelect}
									register={registerPlayer}
								/>
							))}
						</div>
						<div
							className={cn(
								'relative z-50 mt-2 min-h-[84px] transition-opacity duration-200',
								controlsVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
							)}
						>
							{controls}
						</div>
					</div>
				)}

				{viewMode === 'grid' && config.count !== 3 && (
					<div className={cn('grid h-full w-full gap-2 bg-black sm:gap-3', layoutClass(config.count))}>
						{gridStreams.map((stream) => (
							<VideoTile
								key={stream.id}
								stream={stream}
								active={stream.id === activeId}
								count={config.count}
								activeId={activeId}
								playing={playing}
								muted={muted || stream.id !== activeId}
								chromeVisible={controlsVisible}
								showLabels={false}
								onSelect={handleTileSelect}
								register={registerPlayer}
							/>
						))}
					</div>
				)}

				{viewMode === 'focused' && activeStream && (
					<div className='grid h-full w-full grid-cols-[minmax(0,1fr)_minmax(180px,24vw)] gap-2 bg-black sm:gap-3'>
						<VideoTile
							stream={activeStream}
							active
							count={config.count}
							activeId={activeId}
							playing={playing}
							muted={muted}
							chromeVisible={controlsVisible}
							showLabels
							className='h-full'
							useGridSpan={false}
							onSelect={handleTileSelect}
							register={registerPlayer}
						/>
						<div
							className='grid min-h-0 gap-2 sm:gap-3'
							style={{ gridTemplateRows: `repeat(${secondaryStreams.length}, minmax(0, 1fr))` }}
						>
							{secondaryStreams.map((stream) => (
								<VideoTile
									key={stream.id}
									stream={stream}
									active={false}
									count={config.count}
									activeId={activeId}
									playing={playing}
									muted
									chromeVisible={controlsVisible}
									showLabels
									className='min-h-0'
									useGridSpan={false}
									onSelect={handleTileSelect}
									register={registerPlayer}
								/>
							))}
						</div>
					</div>
				)}

				{viewMode === 'single' && activeStream && (
					<div className='h-full w-full bg-black'>
						<VideoTile
							stream={activeStream}
							active
							count={config.count}
							activeId={activeId}
							playing={playing}
							muted={muted}
							chromeVisible={controlsVisible}
							showLabels={false}
							showActiveBorder={false}
							className='h-full w-full'
							useGridSpan={false}
							onSelect={() => undefined}
							register={registerPlayer}
						/>
					</div>
				)}
			</div>

			<div
				className={cn(
					'pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/85 via-black/45 to-transparent transition-opacity duration-200',
					showGridGradient ? 'opacity-100' : 'opacity-0',
				)}
			/>
			{!controlsBelowGrid && (
				<div
					className={cn(
						'absolute inset-x-0 top-0 z-50 flex items-start justify-between p-5 transition-opacity duration-200 sm:p-8',
						controlsVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
					)}
				>
					<button
						type='button'
						onClick={handleBackClick}
						className='pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/35 transition-colors hover:bg-white/15'
						aria-label='Back'
					>
						<BackIcon className='h-4 w-5' />
					</button>
					<div className='rounded-full bg-black/35 px-3 py-1.5 font-semibold text-white/80 text-xs'>
						{viewMode === 'single' ? activeStream?.label : `Multiview x${config.count}`}
					</div>
				</div>
			)}

			{!controlsBelowGrid && (
				<div
					className={cn(
						'absolute inset-x-0 bottom-0 z-50 p-5 transition-opacity duration-200 sm:p-8',
						controlsVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
					)}
				>
					{controls}
				</div>
			)}
		</div>
	)
}
