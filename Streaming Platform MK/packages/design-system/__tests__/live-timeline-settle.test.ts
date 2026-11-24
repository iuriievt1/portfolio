import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement as h, type ReactNode } from 'react'
import { PlaybackContext, type PlaybackState, PlayerContext } from '../components/features/VideoPlayer/context'
import { Timeline } from '../components/features/VideoPlayer/Timeline/Timeline.web'

const BAR_WIDTH = 1158
const SETTLE_MS = 1200

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

/** The filled part of the track — the element whose width carries the playhead. */
const fill = () => document.querySelector('[data-player-timeline] [style*="width"]') as HTMLElement

function clickAt(ratio: number) {
	const track = document.querySelector('[data-player-timeline] > div:last-child') as HTMLElement
	fireEvent.mouseDown(track, { clientX: BAR_WIDTH * ratio })
	fireEvent.mouseUp(window, { clientX: BAR_WIDTH * ratio })
}

describe('easing the bar to its true position after a live seek', () => {
	// A live seek takes the player most of a second and the live edge moves while it works, so the
	// playhead lands a little further behind live than the click asked for. The correction is real;
	// it is eased so it does not read as the bar glitching sideways.
	const LIVE_WINDOW = 60
	const originalRect = Element.prototype.getBoundingClientRect

	beforeEach(() => {
		vi.useFakeTimers()
		stubBarWidth()
	})

	afterEach(() => {
		cleanup()
		vi.useRealTimers()
		Element.prototype.getBoundingClientRect = originalRect
	})

	it('does not ease while nothing has been seeked', () => {
		render(wrap(playback({ isLive: true, duration: LIVE_WINDOW, currentTime: 30 })))

		expect(fill().className).not.toMatch(/transition-\[width,left\]/)
	})

	it('eases the correction for the moment after a live seek', () => {
		render(wrap(playback({ isLive: true, duration: LIVE_WINDOW, currentTime: 55 })))

		act(() => clickAt(0.25))

		expect(fill().className).toMatch(/transition-\[width,left\]/)
	})

	it('stops easing once the seek has settled, so playback moves the bar natively', () => {
		render(wrap(playback({ isLive: true, duration: LIVE_WINDOW, currentTime: 55 })))

		act(() => clickAt(0.25))
		act(() => vi.advanceTimersByTime(SETTLE_MS + 50))

		expect(fill().className).not.toMatch(/transition-\[width,left\]/)
	})

	it('leaves VOD alone — its window does not move, so the landing needs no correction', () => {
		render(wrap(playback({ isLive: false, duration: 7200, currentTime: 100 })))

		act(() => clickAt(0.25))

		expect(fill().className).not.toMatch(/transition-\[width,left\]/)
	})
})
