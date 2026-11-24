import {
	calculateTimelineProgress,
	resolvePlaybackMeta,
	toPlayerSeekTime,
	toTimelineTime,
	toWallClockMs,
	withSeekableWindow,
} from '../components/features/VideoPlayer/utils/playback-live'

describe('Timeline progress calculation edge cases', () => {
	it('clamps progress to 0 when displayTime is negative', () => {
		expect(calculateTimelineProgress({ displayTime: -1, duration: 10 })).toBeGreaterThanOrEqual(0)
	})

	it('clamps progress to 0 for large negative displayTime', () => {
		expect(calculateTimelineProgress({ displayTime: -100, duration: 10 })).toBeGreaterThanOrEqual(0)
	})

	it('clamps progress to 100 when displayTime exceeds duration', () => {
		expect(calculateTimelineProgress({ displayTime: 11, duration: 10 })).toBe(100)
	})

	it('returns 0 when both displayTime and duration are 0', () => {
		expect(calculateTimelineProgress({ displayTime: 0, duration: 0 })).toBe(0)
	})

	it('returns 0 when duration is NaN', () => {
		expect(calculateTimelineProgress({ displayTime: 5, duration: Number.NaN })).toBe(0)
	})

	it('calculates correct progress for normal values', () => {
		expect(calculateTimelineProgress({ displayTime: 30, duration: 120 })).toBe(25)
	})

	it('returns 100 at end of playback', () => {
		expect(calculateTimelineProgress({ displayTime: 120, duration: 120 })).toBe(100)
	})

	it('returns 0 when duration is negative', () => {
		expect(calculateTimelineProgress({ displayTime: 5, duration: -5 })).toBe(0)
	})

	it('returns 0 when duration is Infinity', () => {
		expect(calculateTimelineProgress({ displayTime: 5, duration: Number.POSITIVE_INFINITY })).toBe(0)
	})
})

describe('live playback metadata', () => {
	it('marks finite VOD as seekable and not live', () => {
		const meta = resolvePlaybackMeta({ rawDuration: 120, playerIsLive: false })

		expect(meta).toEqual({
			isLive: false,
			canSeek: true,
			duration: 120,
			seekableStart: 0,
			seekableEnd: 120,
		})
	})

	it('marks Infinity duration live as non-seekable without a DVR window', () => {
		const meta = resolvePlaybackMeta({ rawDuration: Number.POSITIVE_INFINITY, playerIsLive: true })

		expect(meta.isLive).toBe(true)
		expect(meta.canSeek).toBe(false)
		expect(meta.duration).toBe(0)
		expect(toPlayerSeekTime({ timelineTime: 30, meta })).toBeNull()
	})

	it('allows live seeking when a finite DVR window is available', () => {
		const meta = resolvePlaybackMeta({
			rawDuration: Number.POSITIVE_INFINITY,
			playerIsLive: true,
			seekableRange: { start: 1000, end: 1300 },
		})

		expect(meta.isLive).toBe(true)
		expect(meta.canSeek).toBe(true)
		expect(meta.duration).toBe(300)
		expect(toTimelineTime({ rawTime: 1125, meta })).toBe(125)
		expect(toPlayerSeekTime({ timelineTime: 60, meta })).toBe(1060)
	})

	it('uses maxTimeShift as DVR duration when seekable range is unavailable', () => {
		const meta = resolvePlaybackMeta({
			rawDuration: Number.POSITIVE_INFINITY,
			playerIsLive: true,
			maxTimeShift: 180,
		})

		expect(meta.isLive).toBe(true)
		expect(meta.canSeek).toBe(true)
		expect(meta.duration).toBe(180)
	})
})

describe('refreshing the sliding live window', () => {
	const meta = resolvePlaybackMeta({
		rawDuration: Number.POSITIVE_INFINITY,
		playerIsLive: true,
		seekableRange: { start: 1_787_301_286, end: 1_787_301_344 },
	})

	it('moves the window on without touching live-ness', () => {
		const moved = withSeekableWindow({ range: { start: 1_787_301_346, end: 1_787_301_404 }, meta })

		expect(moved.seekableStart).toBe(1_787_301_346)
		expect(moved.duration).toBe(58)
		expect(moved.isLive).toBe(true)
		expect(moved.canSeek).toBe(true)
	})

	it('keeps the previous window when the reading is unusable', () => {
		expect(withSeekableWindow({ range: null, meta })).toEqual(meta)
		expect(withSeekableWindow({ range: { start: 5, end: 5 }, meta })).toEqual(meta)
	})

	it('leaves VOD metadata alone', () => {
		const vod = resolvePlaybackMeta({ rawDuration: 7200, playerIsLive: false })

		expect(withSeekableWindow({ range: { start: 10, end: 90 }, meta: vod })).toEqual(vod)
	})

	it('keeps a live playhead off the end of the bar as the window slides', () => {
		// The bug: mapping against the window loaded with pins the scrubber at 100% within a minute.
		const later = withSeekableWindow({ range: { start: 1_787_301_346, end: 1_787_301_404 }, meta })
		const playhead = 1_787_301_400

		expect(toTimelineTime({ rawTime: playhead, meta })).toBe(58)
		expect(toTimelineTime({ rawTime: playhead, meta: later })).toBe(54)
	})

	it('aims a seek at the window as it is now', () => {
		const later = withSeekableWindow({ range: { start: 1_787_301_346, end: 1_787_301_404 }, meta })

		expect(toPlayerSeekTime({ timelineTime: 20, meta })).toBe(1_787_301_306)
		expect(toPlayerSeekTime({ timelineTime: 20, meta: later })).toBe(1_787_301_366)
	})
})

describe('holding the timeline steady while the window breathes', () => {
	// Measured off the live multiview stream: the live edge advances a second per second while the
	// tail lurches by one 2.007s segment, so the reported width flips between 58.078 and 60.085.
	const SEGMENT = 2.007
	const NOMINAL = 60.085
	const settled = resolvePlaybackMeta({
		rawDuration: Number.POSITIVE_INFINITY,
		playerIsLive: true,
		seekableRange: { start: 1_787_301_286 - NOMINAL, end: 1_787_301_286 },
	})

	it('keeps the axis width when the tail drops a segment', () => {
		const dipped = withSeekableWindow({
			range: { start: 1_787_301_287 - NOMINAL + SEGMENT, end: 1_787_301_287 },
			meta: settled,
		})

		expect(dipped.duration).toBeCloseTo(NOMINAL, 3)
		expect(dipped.seekableEnd).toBe(1_787_301_287)
		expect(dipped.seekableStart).toBeCloseTo(1_787_301_287 - NOMINAL, 3)
	})

	it('leaves a deeply rewound playhead where the viewer put it', () => {
		// The regression: re-deriving the axis from the lurching tail moved the marker by
		// distanceBehindLive * segment / width² — ~3 percentage points at 52s back on a 60s window.
		const playhead = 1_787_301_286 - 52

		const before = calculateTimelineProgress({
			displayTime: toTimelineTime({ rawTime: playhead, meta: settled }),
			duration: settled.duration,
		})
		const dipped = withSeekableWindow({
			range: { start: 1_787_301_286 - NOMINAL + SEGMENT, end: 1_787_301_286 },
			meta: settled,
		})
		const after = calculateTimelineProgress({
			displayTime: toTimelineTime({ rawTime: playhead, meta: dipped }),
			duration: dipped.duration,
		})

		expect(after).toBeCloseTo(before, 6)
	})

	it('turns seeking on once a live window turns up', () => {
		// A live source read before its window exists reports canSeek false. Nothing else revisits
		// it, so without this the scrubber stays disabled for the whole session.
		const noWindow = resolvePlaybackMeta({ rawDuration: Number.POSITIVE_INFINITY, playerIsLive: true })
		expect(noWindow.canSeek).toBe(false)

		const withWindow = withSeekableWindow({ range: { start: 1_787_301_286 - 60, end: 1_787_301_286 }, meta: noWindow })

		expect(withWindow.canSeek).toBe(true)
		expect(withWindow.duration).toBe(60)
	})

	it('never disables seeking again once it is on', () => {
		const unusable = withSeekableWindow({ range: { start: 5, end: 5 }, meta: settled })

		expect(unusable.canSeek).toBe(true)
	})

	it('adopts a width that genuinely changed', () => {
		const swapped = withSeekableWindow({ range: { start: 1_787_301_286 - 7200, end: 1_787_301_286 }, meta: settled })

		expect(swapped.duration).toBe(7200)
		expect(swapped.seekableStart).toBe(1_787_301_286 - 7200)
	})

	it('grows to the nominal width when the first reading was a short one', () => {
		const short = resolvePlaybackMeta({
			rawDuration: Number.POSITIVE_INFINITY,
			playerIsLive: true,
			seekableRange: { start: 1_787_301_286 - (NOMINAL - SEGMENT), end: 1_787_301_286 },
		})
		const grown = withSeekableWindow({ range: { start: 1_787_301_287 - NOMINAL, end: 1_787_301_287 }, meta: short })

		expect(grown.duration).toBeCloseTo(NOMINAL, 3)
	})
})

describe('live hover wall clock', () => {
	const NOW = new Date(2026, 7, 22, 15, 47, 32).getTime()

	it('maps the live edge to now', () => {
		expect(toWallClockMs({ timelineTime: 7200, duration: 7200, nowMs: NOW })).toBe(NOW)
	})

	it('maps a position behind the edge to that many seconds ago', () => {
		expect(toWallClockMs({ timelineTime: 6900, duration: 7200, nowMs: NOW })).toBe(NOW - 300_000)
	})

	it('advances for a fixed timeline position as the window moves on', () => {
		const early = toWallClockMs({ timelineTime: 89929, duration: 89929, nowMs: NOW }) as number
		const later = toWallClockMs({ timelineTime: 89959, duration: 89959, nowMs: NOW + 30_000 }) as number

		expect(later - early).toBe(30_000)
	})

	it('clamps a position past either end of the window', () => {
		expect(toWallClockMs({ timelineTime: 9000, duration: 7200, nowMs: NOW })).toBe(NOW)
		expect(toWallClockMs({ timelineTime: -60, duration: 7200, nowMs: NOW })).toBe(NOW - 7_200_000)
	})

	it('returns null without a usable window or clock', () => {
		expect(toWallClockMs({ timelineTime: 10, duration: 0, nowMs: NOW })).toBeNull()
		expect(toWallClockMs({ timelineTime: 10, duration: Number.POSITIVE_INFINITY, nowMs: NOW })).toBeNull()
		expect(toWallClockMs({ timelineTime: 10, duration: 7200, nowMs: Number.NaN })).toBeNull()
	})
})
