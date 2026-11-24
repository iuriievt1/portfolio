export type SeekableRange = {
	start: number
	end: number
}

export type PlaybackMetaInput = {
	rawDuration: number
	playerIsLive: boolean
	maxTimeShift?: number
	seekableRange?: SeekableRange | null
}

export type PlaybackMeta = {
	isLive: boolean
	canSeek: boolean
	duration: number
	seekableStart: number
	seekableEnd: number
}

export type TimelineTimeInput = {
	rawTime: number
	meta: PlaybackMeta
}

export type PlayerSeekTimeInput = {
	timelineTime: number
	meta: PlaybackMeta
}

export type WindowRefreshInput = {
	range: SeekableRange | null | undefined
	meta: PlaybackMeta
}

export type WallClockInput = {
	timelineTime: number
	duration: number
	nowMs: number
}

export type TimelineProgressInput = {
	displayTime: number
	duration: number
}

export function positiveFinite(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

export function normalizeSeekableRange(range: SeekableRange | null | undefined): SeekableRange | null {
	if (!range) return null
	const start = positiveFinite(range.start)
	const end = positiveFinite(range.end)
	return end > start ? { start, end } : null
}

export function resolvePlaybackMeta({
	rawDuration,
	playerIsLive,
	maxTimeShift,
	seekableRange,
}: PlaybackMetaInput): PlaybackMeta {
	const normalizedRange = normalizeSeekableRange(seekableRange)
	const finiteDuration = positiveFinite(rawDuration)
	const dvrWindow = normalizedRange ? normalizedRange.end - normalizedRange.start : positiveFinite(maxTimeShift)
	const inferredLive = playerIsLive || rawDuration === Number.POSITIVE_INFINITY
	const liveDuration = positiveFinite(dvrWindow) || finiteDuration
	const duration = inferredLive ? liveDuration : finiteDuration

	return {
		isLive: inferredLive,
		canSeek: inferredLive ? duration > 0 : finiteDuration > 0,
		duration,
		seekableStart: inferredLive && normalizedRange ? normalizedRange.start : 0,
		seekableEnd: inferredLive && normalizedRange ? normalizedRange.end : duration,
	}
}

export function toTimelineTime({ rawTime, meta }: TimelineTimeInput): number {
	const finiteTime = positiveFinite(rawTime)
	const relative = meta.isLive && meta.seekableStart > 0 ? finiteTime - meta.seekableStart : finiteTime
	if (!meta.duration) return 0
	return Math.max(0, Math.min(meta.duration, relative))
}

export function toPlayerSeekTime({ timelineTime, meta }: PlayerSeekTimeInput): number | null {
	if (!meta.canSeek) return null
	const safeTime = Math.max(0, Math.min(meta.duration, positiveFinite(timelineTime)))
	return meta.isLive && meta.seekableStart > 0 ? meta.seekableStart + safeTime : safeTime
}

export function calculateTimelineProgress({ displayTime, duration }: TimelineProgressInput): number {
	const safeDuration = positiveFinite(duration)
	if (!safeDuration) return 0
	return Math.max(0, Math.min((positiveFinite(displayTime) / safeDuration) * 100, 100))
}

/**
 * How far a window width may wander before it counts as a real change rather than segment churn.
 * A packager drops and adds whole segments, so a reading a few percent off the established width
 * is the same window, not a new one.
 */
const WIDTH_TOLERANCE = 0.25

/**
 * Fold a freshly read seekable range into existing metadata. Live-ness and seekability are left
 * exactly as the loaded source set them — only the sliding window moves. An unusable reading
 * keeps the window we already had rather than collapsing the timeline.
 *
 * The window is hung off its end, not its start: a packager advances the live edge smoothly but
 * lurches the tail by a whole segment as old ones age out, and rescaling the bar from that tail
 * shifts the playhead by `distanceBehindLive * widthChange / width²` — a jump that grows the
 * further back the viewer has seeked. Holding the established width keeps the axis still.
 */
export function withSeekableWindow({ range, meta }: WindowRefreshInput): PlaybackMeta {
	if (!meta.isLive) return meta
	const normalized = normalizeSeekableRange(range)
	if (!normalized) return meta
	const measured = normalized.end - normalized.start
	const settled = positiveFinite(meta.duration)
	// Within tolerance this is the same window breathing by a segment, so keep the widest reading
	// seen — that is its nominal size. Beyond tolerance the window genuinely changed; take it.
	const duration =
		settled && Math.abs(measured - settled) <= settled * WIDTH_TOLERANCE ? Math.max(settled, measured) : measured

	return {
		...meta,
		// A live source read before its window exists reports canSeek false, and nothing else ever
		// revisits it — the scrubber stays dead for the session. Promote it once a usable window
		// turns up, but never the other way round: one bad reading must not disable seeking.
		canSeek: meta.canSeek || duration > 0,
		duration,
		seekableStart: normalized.end - duration,
		seekableEnd: normalized.end,
	}
}

/**
 * Wall-clock instant a live timeline position maps to. The right edge of the bar is the live
 * edge, so a point `duration - timelineTime` seconds back on the bar aired that long ago.
 */
export function toWallClockMs({ timelineTime, duration, nowMs }: WallClockInput): number | null {
	const safeDuration = positiveFinite(duration)
	if (!safeDuration || !Number.isFinite(nowMs)) return null
	const clamped = Math.max(0, Math.min(safeDuration, positiveFinite(timelineTime)))
	return nowMs - (safeDuration - clamped) * 1000
}
