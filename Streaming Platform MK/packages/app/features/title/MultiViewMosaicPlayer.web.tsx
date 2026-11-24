'use client'

import type { MKSourceConfig } from '@mediakind/mkplayer'
import type { MultiviewSpotlight } from '@pkg/app/data/mk-api'
import {
	type AudioTrackOption,
	VideoPlayer as Player,
	useControls,
	usePlayback,
	usePlayer,
	useTracks,
} from '@pkg/design-system'
import { cn } from '@pkg/utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AudioRenditionProbe } from './AudioRenditionProbe.web'
import { feedCell, feedZoomTransform, type MosaicCell, mosaicLayout } from './mosaic-geometry'
import { groupAudioFeeds, type MultiViewFeed, spotlightTileSources } from './multiview-feeds'
import { spotlightResume } from './spotlight-resume'
import { useSafeBack } from './use-safe-back'

type MultiViewMosaicPlayerProps = {
	mediaId?: string
	offerId?: string
	serverUrl?: string
	authToken?: string
	ownerUid?: string
	applicationToken?: string
	assetType?: MKSourceConfig['assetType']
	title?: string
	hlsUrl?: string
	onError?: () => void
	/** Spotlight variants of this mosaic, this stream included. Empty when MK ships none. */
	spotlights?: MultiviewSpotlight[]
}

/** Trimmed off each feed edge when zoomed, so the tile's baked-in rounded corners stay out (#66). */
const MOSAIC_ZOOM_OVERSCAN_PCT = 1.2

// Picking a tile swaps the audio rendition, which stalls the mosaic while the SDK refills the audio
// buffer. Most of that ~1s freeze is the SDK waiting for its default 0.9s of buffer before resuming
// — 0.2s is the SDK's own low-latency floor and keeps the switch near-instant (#84). Scoped to this
// player: a smaller cushion against real network stalls is a fair trade only where we cause the stall.
const MOSAIC_TWEAKS = { restart_threshold: 0.2 } as const

// The refill still costs a beat of frozen picture. Dipping the mosaic for that beat gives the eye
// motion to follow, so the pause reads as the switch happening rather than as a dropped stream.
const FEED_SWITCH_DIP_MS = 420

// A spotlight switch reloads the whole stream rather than one audio rendition, so the gap is much
// longer and varies. The dip therefore holds until playback resumes — capped, so a stream that
// never comes back cannot leave the mosaic dimmed forever.
const FEED_SWITCH_DIP_MAX_MS = 6_000

type Rect = { left: number; top: number; width: number; height: number }

/** Pixel rect of the contained <video> inside the player box. The mosaic is object-fit: contain, so
 *  it's letterboxed within the viewport; the hotspot grid must overlay the video, not the viewport. */
function useVideoContentRect(): Rect | null {
	const { containerRef } = usePlayer()
	const [rect, setRect] = useState<Rect | null>(null)

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		let wired: HTMLVideoElement | null = null

		const measure = (): boolean => {
			const video = container.querySelector('video')
			if (!video) return false
			if (video !== wired) {
				wired?.removeEventListener('loadedmetadata', measure)
				wired?.removeEventListener('resize', measure)
				video.addEventListener('loadedmetadata', measure)
				video.addEventListener('resize', measure)
				wired = video
			}
			const { videoWidth: vw, videoHeight: vh } = video
			const cw = container.clientWidth
			const ch = container.clientHeight
			if (!vw || !vh || !cw || !ch) return false
			const scale = Math.min(cw / vw, ch / vh)
			const width = vw * scale
			const height = vh * scale
			setRect({ left: (cw - width) / 2, top: (ch - height) / 2, width, height })
			return true
		}

		measure()
		const ro = new ResizeObserver(() => measure())
		ro.observe(container)
		// Video mounts async after SDK init; poll until metadata is known, then rely on observers.
		const poll = setInterval(() => {
			if (measure()) clearInterval(poll)
		}, 300)

		return () => {
			ro.disconnect()
			clearInterval(poll)
			wired?.removeEventListener('loadedmetadata', measure)
			wired?.removeEventListener('resize', measure)
		}
	}, [containerRef])

	return rect
}

function FeedHotspot({
	feed,
	label,
	cell,
	active,
	onSelect,
}: {
	feed: MultiViewFeed
	label: string
	cell: MosaicCell
	active: boolean
	onSelect: (feed: MultiViewFeed) => void
}) {
	return (
		<button
			type='button'
			style={{
				position: 'absolute',
				left: `${cell.left * 100}%`,
				top: `${cell.top * 100}%`,
				width: `${cell.width * 100}%`,
				height: `${cell.height * 100}%`,
			}}
			// Stop propagation so the feed click doesn't toggle the underlying player play/pause.
			onClick={(e) => {
				e.stopPropagation()
				onSelect(feed)
			}}
			className='group pointer-events-auto relative overflow-hidden rounded-[6px] focus-visible:outline-none'
			aria-label={active ? `Open ${label}` : `Watch ${label}`}
			aria-pressed={active}
		>
			<span
				className={cn(
					'pointer-events-none absolute inset-0 rounded-[6px] ring-inset transition-all duration-150',
					active ? 'ring-4 ring-white' : 'ring-0 ring-white/0 group-hover:ring-2 group-hover:ring-white/50',
				)}
			/>
		</button>
	)
}

/** Zooms the mosaic video onto one feed, so it fills the frame like a normal single-view stream. */
function useFeedZoom(cell: MosaicCell | null, videoRect: Rect | null, overscan: number) {
	const { containerRef } = usePlayer()

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		container.style.transformOrigin = '0 0'
		container.style.transition = 'transform 300ms ease, clip-path 300ms ease'

		const zoom =
			!cell || !videoRect
				? null
				: feedZoomTransform({
						videoRect,
						containerWidth: container.clientWidth,
						containerHeight: container.clientHeight,
						cell,
						overscan,
					})

		container.style.transform = zoom
			? `translate(${zoom.translateX}px, ${zoom.translateY}px) scale(${zoom.scale})`
			: 'none'
		container.style.clipPath = zoom
			? `inset(${zoom.clip.top}px ${zoom.clip.right}px ${zoom.clip.bottom}px ${zoom.clip.left}px)`
			: 'none'

		return () => {
			container.style.transform = 'none'
			container.style.clipPath = 'none'
		}
	}, [containerRef, cell, videoRect, overscan])
}

/**
 * True from a feed switch until the picture is back — at least a beat, at most the cap. An audio
 * swap settles within the beat; a spotlight swap tears the SDK player down and rebuilds it, so the
 * dip has to wait for playback rather than guess a duration.
 */
function useFeedSwitchDip(switchCount: number, resumed: boolean): boolean {
	const [startedAt, setStartedAt] = useState<number | null>(null)

	useEffect(() => {
		if (switchCount === 0) return
		setStartedAt(Date.now())
		const cap = setTimeout(() => setStartedAt(null), FEED_SWITCH_DIP_MAX_MS)
		return () => clearTimeout(cap)
	}, [switchCount])

	useEffect(() => {
		if (startedAt === null || !resumed) return
		const remaining = Math.max(0, FEED_SWITCH_DIP_MS - (Date.now() - startedAt))
		const timer = setTimeout(() => setStartedAt(null), remaining)
		return () => clearTimeout(timer)
	}, [startedAt, resumed])

	return startedAt !== null
}

/**
 * Carries the playhead across a spotlight switch. Sits inside the player so it can watch playback,
 * and survives the SDK teardown the switch causes — the remembered position would be lost with any
 * component that unmounts along with the overlay.
 */
function SpotlightResume({ mediaId }: { mediaId?: string }) {
	const { currentTime, isLive, isPlaying, seek } = usePlayback()
	const positionRef = useRef(0)
	const pendingRef = useRef<number | null>(null)
	const loadedRef = useRef(mediaId)

	// Remember where the outgoing variant had got to; a reloaded stream reports 0 before it starts.
	useEffect(() => {
		if (!isLive && currentTime > 0) positionRef.current = currentTime
	}, [currentTime, isLive])

	useEffect(() => {
		if (mediaId === loadedRef.current) return
		loadedRef.current = mediaId
		pendingRef.current = positionRef.current
	}, [mediaId])

	useEffect(() => {
		const verdict = spotlightResume({ pending: pendingRef.current, isLive, isPlaying, currentTime })
		if (verdict.action === 'wait') return

		pendingRef.current = null
		if (verdict.action === 'seek') seek(verdict.time)
	}, [currentTime, isLive, isPlaying, seek])

	return null
}

/**
 * The dim that covers a switch. It lives outside `MosaicOverlay` on purpose: a spotlight switch
 * drops the SDK player, which empties the feed list and unmounts the overlay — taking the only
 * feedback with it exactly when the gap is longest.
 */
function FeedSwitchDim({ switchCount }: { switchCount: number }) {
	const { isPlaying, isBuffering } = usePlayback()
	const videoRect = useVideoContentRect()
	const dipping = useFeedSwitchDip(switchCount, isPlaying && !isBuffering)

	if (!videoRect) return null

	return (
		<div
			className={cn(
				// Dips in quickly to land with the click, eases back out as the picture resumes.
				'pointer-events-none absolute bg-black transition-opacity ease-out',
				dipping ? 'opacity-25 duration-100' : 'opacity-0 duration-300',
			)}
			style={{ left: videoRect.left, top: videoRect.top, width: videoRect.width, height: videoRect.height }}
		/>
	)
}

type MosaicOverlayProps = {
	/** Feed key currently opened full-frame, or null while the mosaic grid is shown. */
	focusedKey: string | null
	onFocusFeed: (key: string) => void
	/** Canonical source the loaded variant enlarges, or undefined when the mosaic has no variants. */
	loadedSource?: string
	/** Canonical sources MK ships a variant for, in base order; empty when the mosaic has none. */
	canonicalSources: string[]
	onSpotlightSource: (source: string) => void
	/** Tells the player a switch just started, so it can cover the gap. */
	onSwitch: () => void
}

/** Clickable 2×2 grid overlaid on the composited mosaic video; opens the picked feed full-frame. */
function MosaicOverlay({
	focusedKey,
	onFocusFeed,
	loadedSource,
	canonicalSources,
	onSpotlightSource,
	onSwitch,
}: MosaicOverlayProps) {
	const { audioTracks, selectedAudioId, setAudioTrack } = useTracks()
	const videoRect = useVideoContentRect()
	// Feed keys are positional — `eng_A` is whatever sits in the big tile — so key order already is
	// tile order and must not be rearranged. `tileSources` says which source each tile holds.
	const feeds = useMemo(() => groupAudioFeeds(audioTracks), [audioTracks])
	const tileSources = useMemo(
		() => (loadedSource ? spotlightTileSources(canonicalSources, loadedSource) : []),
		[canonicalSources, loadedSource],
	)
	// A switch reloads the stream and the SDK comes back on the variant's default audio. The source
	// the viewer picked is now the big tile, and the big tile is always the first feed, so that is
	// what gets selected — keeping the language already playing.
	const currentLang = audioTracks.find((track) => track.id === selectedAudioId)?.lang
	const [appliedSource, setAppliedSource] = useState(loadedSource)
	useEffect(() => {
		if (!loadedSource || loadedSource === appliedSource) return
		const big = feeds[0]
		if (!big) return

		const sameLang = big.tracks.find((track) => track.lang === currentLang)
		setAudioTrack(sameLang?.id ?? big.defaultAudioId)
		setAppliedSource(loadedSource)
	}, [loadedSource, appliedSource, feeds, currentLang, setAudioTrack])

	// The tile rects already carry the mosaic's own margin and gutter, so the ring hugs each feed
	// without any further correction.
	const cells = useMemo(() => mosaicLayout(feeds.length), [feeds.length])
	const overscan = videoRect ? (videoRect.width * MOSAIC_ZOOM_OVERSCAN_PCT) / 100 : 0
	const focusedIndex = feeds.findIndex((feed) => feed.key === focusedKey)
	const focusedCell = focusedIndex >= 0 ? feedCell(feeds.length, focusedIndex) : null
	useFeedZoom(focusedCell, videoRect, overscan)

	// Runtime guard: only show the mosaic overlay once the stream's feed groups are known.
	if (feeds.length < 2) return null
	// The video rect is unknown until metadata lands. Rendering before that would stretch the grid
	// across the viewport and snap it onto the video a beat later (#79).
	if (!videoRect) return null
	// Full-frame feed: no hotspots, so taps fall through to the player's play/pause.
	if (focusedCell) return null

	const audioFeed = feeds.find((feed) => feed.tracks.some((track) => track.id === selectedAudioId)) ?? feeds[0]
	// Where MK ships spotlight variants the enlarged feed is the one being watched, so the ring
	// belongs on the big tile. Deriving it from the audio track instead would leave it on the small
	// tile the viewer just clicked, until the reloaded stream reports its tracks.
	const activeFeed = tileSources.length > 0 ? feeds[0] : audioFeed

	const selectFeed = (feed: MultiViewFeed) => {
		// Where MK ships a variant per spotlight, an inactive tile moves into the big tile instead —
		// the mosaic is baked into the frame, so that means loading that variant's stream (#95). The
		// tile's own key is only its position, so the variant is looked up by the source it shows.
		const source = tileSources[feed.index]
		if (feed !== activeFeed && source) {
			onSpotlightSource(source)
			onSwitch()
			return
		}
		// An inactive tile only takes over the audio; the user stays in the mosaic (#66).
		if (feed !== activeFeed) {
			// Preserve the current language when switching feeds; fall back to the feed default.
			const sameLang = feed.tracks.find((track) => track.lang === currentLang)
			setAudioTrack(sameLang?.id ?? feed.defaultAudioId)
			onSwitch()
			return
		}
		// Picking the tile that is already playing opens it full-frame.
		onFocusFeed(feed.key)
	}

	return (
		// No z-index: as the first overlay child the hotspots sit below the player chrome
		// (controls, back button, gradient) so those stay clickable when the UI is shown.
		<div className='pointer-events-none absolute inset-0'>
			<div
				className='absolute'
				style={{
					// Overlay the actual letterboxed video rect, not the full viewport.
					left: videoRect.left,
					top: videoRect.top,
					width: videoRect.width,
					height: videoRect.height,
				}}
			>
				{feeds.map((feed, index) => {
					const cell = cells[index]
					if (!cell) return null
					return (
						<FeedHotspot
							key={feed.key}
							feed={feed}
							// Positional keys rename themselves on every switch; the source does not.
							label={tileSources[index] ? `Feed ${tileSources[index]}` : feed.label}
							cell={cell}
							active={feed === activeFeed}
							onSelect={selectFeed}
						/>
					)
				})}
			</div>
		</div>
	)
}

/** Bottom scrim behind the controls (per Figma) — fades in/out with the player UI. */
function ControlsGradient() {
	const { visible, activeMenu } = useControls()
	const show = visible || activeMenu !== null
	return (
		<div
			className={cn(
				'pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300',
				show ? 'opacity-100' : 'opacity-0',
			)}
		/>
	)
}

export function MultiViewMosaicPlayer({
	mediaId,
	offerId,
	serverUrl,
	authToken,
	ownerUid,
	applicationToken,
	assetType,
	title,
	hlsUrl,
	onError,
	spotlights = [],
}: MultiViewMosaicPlayerProps) {
	const goBack = useSafeBack()
	const [focusedKey, setFocusedKey] = useState<string | null>(null)
	// Counter, not a boolean: switching again mid-dip has to restart it. Owned here so the dim
	// survives the player teardown a spotlight switch causes.
	const [switchCount, setSwitchCount] = useState(0)
	const noteSwitch = useCallback(() => setSwitchCount((count) => count + 1), [])

	// The variant on screen. Switching spotlight loads a different stream, so this drives the
	// source; it starts on whichever variant the rail linked to.
	const [activeMediaId, setActiveMediaId] = useState(mediaId)
	useEffect(() => setActiveMediaId(mediaId), [mediaId])

	const active = spotlights.find((spotlight) => spotlight.mediaId === activeMediaId)
	// Canonical source order — the order the base variant composites them, which is how the
	// spotlights arrive from the provider.
	const canonicalSources = useMemo(() => spotlights.map((spotlight) => spotlight.feedKey), [spotlights])

	const spotlightSource = useCallback(
		(source: string) => {
			const target = spotlights.find((spotlight) => spotlight.feedKey === source)
			if (!target || target.mediaId === activeMediaId) return
			setActiveMediaId(target.mediaId)
		},
		[spotlights, activeMediaId],
	)

	// A full-frame feed offers only its own languages — the other feeds are not on screen (#66).
	const audioFilter = useMemo(
		() => (focusedKey === null ? undefined : (track: AudioTrackOption) => track.feedKey === focusedKey),
		[focusedKey],
	)

	// Back steps out of a full-frame feed first, then leaves the multiview page.
	const handleBack = useCallback(() => {
		if (focusedKey !== null) {
			setFocusedKey(null)
			return
		}
		goBack()
	}, [focusedKey, goBack])

	// No poster: the card art is the mosaic itself, and the SDK paints it full-frame until the
	// first video frame arrives, which reads as the multiview layout already being up (#79).
	const source: MKSourceConfig = {
		title: title ?? 'Multi View',
		...(assetType ? { assetType } : {}),
		...(activeMediaId && serverUrl && authToken
			? {
					registered: {
						mediaId: activeMediaId,
						offerId,
						// Each variant is its own channel, so its own ServiceCollectionId and owner.
						...((active?.applicationToken ?? applicationToken)
							? { applicationToken: active?.applicationToken ?? applicationToken }
							: {}),
						environmentConfig: {
							serverUrl,
							authToken,
							ownerUid: active?.ownerUid ?? ownerUid,
						},
					},
				}
			: hlsUrl
				? { hls: hlsUrl }
				: {}),
	}

	return (
		<div className='fixed inset-0 z-40 bg-black'>
			<Player source={source} title={title} hlsUrl={hlsUrl} onError={onError} tweaks={MOSAIC_TWEAKS}>
				<Player.Overlay>
					<AudioRenditionProbe />
					<SpotlightResume mediaId={activeMediaId} />
					<FeedSwitchDim switchCount={switchCount} />
					<MosaicOverlay
						focusedKey={focusedKey}
						onFocusFeed={setFocusedKey}
						loadedSource={active?.feedKey}
						canonicalSources={canonicalSources}
						onSpotlightSource={spotlightSource}
						onSwitch={noteSwitch}
					/>
					<Player.BackButton onBack={handleBack} />
					<Player.Loading />
					<Player.Error />
					<ControlsGradient />
					<Player.Controls>
						<div className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5'>
							<Player.Timeline />
							<Player.Time />
							<div className='flex items-center justify-between'>
								<div className='flex h-9 items-center gap-[5px] rounded-full bg-black/20 p-[5px] sm:h-[49px]'>
									<Player.PlayPause />
									<Player.Volume />
								</div>
								<div className='flex h-9 items-center gap-[5px] rounded-full bg-black/20 p-[5px] sm:h-[49px]'>
									<Player.MultiView onSelect={focusedKey !== null ? () => setFocusedKey(null) : undefined} />
									<Player.Audio filter={audioFilter} />
									<Player.Fullscreen />
								</div>
							</div>
						</div>
					</Player.Controls>
				</Player.Overlay>
			</Player>
		</div>
	)
}
