import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement as h, type ReactNode } from 'react'
import { PlaybackContext, type PlaybackState, PlayerContext } from '../components/features/VideoPlayer/context'
import { Timeline } from '../components/features/VideoPlayer/Timeline/Timeline.web'

const BAR_WIDTH = 1158

function playback(overrides: Partial<PlaybackState> = {}): PlaybackState {
	return {
		isPlaying: true,
		currentTime: 0,
		duration: 0,
		isLive: false,
		canSeek: true,
		isBuffering: false,
		play: () => {},
		pause: () => {},
		seek: () => {},
		...overrides,
	}
}

function wrap(state: PlaybackState): ReactNode {
	const player = { player: null, containerRef: { current: null }, wrapperRef: { current: null }, error: null }
	return h(PlayerContext, { value: player }, h(PlaybackContext, { value: state }, h(Timeline, null)))
}

/** jsdom gives every element a zero-size rect, so the bar needs a real width to hover across. */
function stubBarWidth() {
	Element.prototype.getBoundingClientRect = () => ({
		x: 0,
		y: 0,
		left: 0,
		top: 0,
		right: BAR_WIDTH,
		bottom: 5,
		width: BAR_WIDTH,
		height: 5,
		toJSON: () => ({}),
	})
}

function hoverAt(ratio: number) {
	const bar = document.querySelector('[data-player-timeline]') as HTMLElement
	fireEvent.mouseEnter(bar)
	fireEvent.mouseMove(bar, { clientX: BAR_WIDTH * ratio })
}

const label = () => screen.queryByText(/\d{2}:\d{2}|--:--/)?.textContent ?? null

describe('live timeline hover label', () => {
	// The stream from the report: a ~25 h seekable window, hovered at the live edge.
	const LIVE_WINDOW = 89_929
	const NOW = new Date(2026, 7, 22, 15, 47, 32).getTime()
	const originalRect = Element.prototype.getBoundingClientRect

	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(NOW)
		stubBarWidth()
	})

	afterEach(() => {
		cleanup()
		vi.useRealTimers()
		Element.prototype.getBoundingClientRect = originalRect
	})

	it('labels the live edge with the current time of day, not the elapsed window', () => {
		render(wrap(playback({ isLive: true, duration: LIVE_WINDOW })))
		act(() => hoverAt(1))

		// Regression: this used to read 24:58:49 — the whole window as an elapsed duration.
		expect(label()).toBe('15:47:32')
	})

	it('labels a position behind the edge with when that moment aired', () => {
		render(wrap(playback({ isLive: true, duration: 7200 })))
		act(() => hoverAt(0.5))

		expect(label()).toBe('14:47:32')
	})

	it('keeps a pointer resting on the live edge reading the current time', () => {
		// The right-hand end of the bar is the live edge, so it is now by definition.
		render(wrap(playback({ isLive: true, duration: LIVE_WINDOW })))
		act(() => hoverAt(1))
		expect(label()).toBe('15:47:32')

		act(() => vi.advanceTimersByTime(5 * 60_000))

		expect(label()).toBe('15:52:32')
	})

	it('advances a resting pointer behind the edge in step with the clock', () => {
		render(wrap(playback({ isLive: true, duration: 7200 })))
		act(() => hoverAt(0.5))
		expect(label()).toBe('14:47:32')

		act(() => vi.advanceTimersByTime(5 * 60_000))

		// Five minutes of clock, five minutes on the label — never more, never less.
		expect(label()).toBe('14:52:32')
	})

	it('ignores a window that grows under a resting pointer', () => {
		// Reported as the seconds stepping +1 then -1 on a stationary pointer. A channel whose DVR
		// window was still filling grew it by a 2.002s segment every 2s; measuring the distance
		// behind live against that growing window lost 0.8s a step while the clock gained 1s.
		const { rerender } = render(wrap(playback({ isLive: true, duration: 26_967 })))
		act(() => hoverAt(0.6))
		expect(label()).toBe('12:47:45')

		act(() => {
			vi.advanceTimersByTime(2000)
			rerender(wrap(playback({ isLive: true, duration: 26_969 })))
		})

		// Two seconds passed, so the label moved exactly two seconds. Before the fix the segment
		// the window gained pulled 0.8s back out of that, and the seconds visibly stuttered.
		expect(label()).toBe('12:47:47')
	})

	it('tells two positions apart on a window narrower than a minute', () => {
		// The multiview mosaic runs a ~58s DVR window, so the whole bar sits inside one minute.
		// Reported as "the time does not update when hovering over different points": at HH:MM
		// every position on that bar rendered the same label.
		render(wrap(playback({ isLive: true, duration: 58 })))

		act(() => hoverAt(0.2))
		const early = label()
		act(() => hoverAt(0.8))

		expect(early).toBe('15:46:45')
		expect(label()).toBe('15:47:20')
	})

	it('still labels VOD with elapsed time, not a clock', () => {
		render(wrap(playback({ isLive: false, duration: 7200 })))
		act(() => hoverAt(0.5))

		expect(label()).toBe('1:00:00')
	})

	it('hides the label entirely while the stream has no usable window', () => {
		render(wrap(playback({ isLive: true, duration: 0, canSeek: false })))
		act(() => hoverAt(1))

		expect(label()).toBeNull()
	})
})
