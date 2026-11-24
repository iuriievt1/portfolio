import { act, cleanup, render } from '@testing-library/react'
import { createElement as h, type ReactNode } from 'react'
import { PlaybackContext, type PlaybackState, PlayerContext } from '../components/features/VideoPlayer/context'
import { PlaybackProvider } from '../components/features/VideoPlayer/providers/PlaybackProvider.web'

/**
 * A live stream whose seekable window slides forward in real time, like a DVR channel.
 *
 * `seekLatency` models the real thing: a seek takes the player most of a second and the live edge
 * keeps moving while it works, so a target aimed at the edge as it was lands short of the click.
 */
function fakeLivePlayer({ windowLen = 58, origin = 1_787_301_286, seekLatency = 0.7 } = {}) {
	let start = origin
	let current = origin + windowLen - 2
	const handlers = new Map<string, Set<(e: unknown) => void>>()

	return {
		seekCalls: [] as number[],
		/** Slide the window and advance playback by the same amount, as 1x playback does. */
		advance(seconds: number) {
			start += seconds
			current += seconds
			for (const cb of handlers.get('timechanged') ?? []) cb({ time: current })
		},
		window: () => ({ start, end: start + windowLen }),
		getDuration: () => Number.POSITIVE_INFINITY,
		isLive: () => true,
		getMaxTimeShift: () => -windowLen,
		getSeekableRange: () => ({ start, end: start + windowLen }),
		getCurrentTime: () => current,
		isPlaying: () => true,
		play: () => {},
		pause: () => {},
		seek(t: number) {
			this.seekCalls.push(t)
			// The live edge runs on while the player works, then playback resumes at the target.
			start += seekLatency
			current = t
			for (const cb of handlers.get('seeked') ?? []) cb({})
		},
		on(event: string, cb: (e: unknown) => void) {
			if (!handlers.has(event)) handlers.set(event, new Set())
			handlers.get(event)?.add(cb)
		},
		off(event: string, cb: (e: unknown) => void) {
			handlers.get(event)?.delete(cb)
		},
	}
}

/** Renders the provider and hands back a live view of the playback context. */
function mount(player: ReturnType<typeof fakeLivePlayer>) {
	const seen: { state: PlaybackState | null } = { state: null }
	const reader = (ctx: PlaybackState | null) => {
		seen.state = ctx
		return null
	}
	const playerCtx = {
		player: player as never,
		containerRef: { current: null },
		wrapperRef: { current: null },
		error: null,
	}

	render(
		h(
			PlayerContext,
			{ value: playerCtx },
			h(PlaybackProvider, null, h(PlaybackContext.Consumer, null, reader) as ReactNode),
		),
	)
	return seen
}

describe('seeking a live timeline', () => {
	afterEach(cleanup)

	it('aims at the window as it is now, not the one present at load', () => {
		const player = fakeLivePlayer()
		const seen = mount(player)

		// Two minutes of playback: the whole seekable window has slid forward.
		act(() => player.advance(120))

		const duration = seen.state?.duration ?? 0
		act(() => seen.state?.seek(duration * 0.4))

		// Regression: this landed 120 s adrift — exactly how far the window had moved. Measured
		// against the window as it is once the seek has landed, so the seek latency is accounted for.
		const target = player.seekCalls.at(-1) ?? 0
		expect(target - player.window().start).toBeCloseTo(duration * 0.4, 1)
	})

	it('leaves the playhead where the viewer dropped it as the window moves on', () => {
		const player = fakeLivePlayer()
		const seen = mount(player)
		act(() => player.advance(120))

		const duration = seen.state?.duration ?? 0
		act(() => seen.state?.seek(duration * 0.4))
		act(() => player.advance(20))

		expect((seen.state?.currentTime ?? 0) / duration).toBeCloseTo(0.4, 2)
	})

	it('keeps a live playhead off the end of the bar rather than pinning it at 100%', () => {
		const player = fakeLivePlayer()
		const seen = mount(player)

		act(() => player.advance(300))

		// Regression: mapping against the loaded window overflowed and clamped to the full width.
		const ratio = (seen.state?.currentTime ?? 0) / (seen.state?.duration ?? 1)
		expect(ratio).toBeGreaterThan(0.9)
		expect(ratio).toBeLessThanOrEqual(1)
		expect(seen.state?.isLive).toBe(true)
	})
})
