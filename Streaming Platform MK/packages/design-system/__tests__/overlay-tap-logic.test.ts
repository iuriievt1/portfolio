/**
 * Tests for the tap handling logic extracted from Overlay.native.tsx.
 *
 * The handler logic is reimplemented as a pure function so we can
 * test it without rendering React Native components in jsdom.
 */

const DOUBLE_TAP_DELAY = 300

type TapHandlerDeps = {
	width: number
	visible: boolean
	currentTime: number
	duration: number
	showControls: () => void
	hideControls: () => void
	seek: (time: number) => void
	handleSeekIndicator: (side: 'left' | 'right') => void
}

type TapHandlerState = {
	lastTap: number
	tapTimer: ReturnType<typeof setTimeout> | undefined
}

function createTapHandler(deps: TapHandlerDeps, state: TapHandlerState) {
	return (locationX: number) => {
		if (!Number.isFinite(locationX)) return

		const now = Date.now()

		if (now - state.lastTap < DOUBLE_TAP_DELAY) {
			if (state.tapTimer) clearTimeout(state.tapTimer)
			const thirdWidth = deps.width / 3
			if (locationX < thirdWidth) {
				deps.seek(Math.max(0, deps.currentTime - 10))
				deps.handleSeekIndicator('left')
			} else if (locationX > thirdWidth * 2) {
				deps.seek(Math.min(deps.duration, deps.currentTime + 10))
				deps.handleSeekIndicator('right')
			}
			state.lastTap = 0
		} else {
			state.lastTap = now
			state.tapTimer = setTimeout(() => {
				if (deps.visible) {
					deps.hideControls()
				} else {
					deps.showControls()
				}
			}, DOUBLE_TAP_DELAY)
		}
	}
}

function cleanup(state: TapHandlerState) {
	if (state.tapTimer) clearTimeout(state.tapTimer)
}

describe('Overlay tap handler logic', () => {
	let deps: TapHandlerDeps
	let state: TapHandlerState

	beforeEach(() => {
		vi.useFakeTimers()
		deps = {
			width: 390,
			visible: false,
			currentTime: 30,
			duration: 120,
			showControls: vi.fn(),
			hideControls: vi.fn(),
			seek: vi.fn(),
			handleSeekIndicator: vi.fn(),
		}
		state = { lastTap: 0, tapTimer: undefined }
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('clears pending single-tap timer on unmount', () => {
		const handleTap = createTapHandler(deps, state)

		handleTap(195)
		expect(state.tapTimer).toBeDefined()

		cleanup(state)
		vi.advanceTimersByTime(DOUBLE_TAP_DELAY + 50)

		expect(deps.showControls).not.toHaveBeenCalled()
		expect(deps.hideControls).not.toHaveBeenCalled()
	})

	it('ignores undefined locationX without NaN calculations', () => {
		const handleTap = createTapHandler(deps, state)

		vi.setSystemTime(1000)
		handleTap(100)

		vi.setSystemTime(1100)
		handleTap(undefined as unknown as number)

		expect(deps.seek).not.toHaveBeenCalled()
		expect(deps.handleSeekIndicator).not.toHaveBeenCalled()
		expect(state.lastTap).not.toBe(0)
	})

	it('does not produce NaN or Infinity when width is 0', () => {
		deps.width = 0
		const handleTap = createTapHandler(deps, state)

		vi.setSystemTime(1000)
		handleTap(100)

		vi.setSystemTime(1100)
		handleTap(100)

		if (deps.seek.mock.calls.length > 0) {
			const seekArg = deps.seek.mock.calls[0]?.[0]
			expect(Number.isFinite(seekArg)).toBe(true)
		}
	})

	it('does not double-seek on rapid triple-tap', () => {
		const handleTap = createTapHandler(deps, state)
		const leftZone = 50

		vi.setSystemTime(1000)
		handleTap(leftZone)
		expect(deps.seek).not.toHaveBeenCalled()

		vi.setSystemTime(1100)
		handleTap(leftZone)
		expect(deps.seek).toHaveBeenCalledTimes(1)
		expect(deps.seek).toHaveBeenCalledWith(20)

		expect(state.lastTap).toBe(0)

		vi.setSystemTime(1200)
		handleTap(leftZone)
		expect(deps.seek).toHaveBeenCalledTimes(1)
		expect(state.tapTimer).toBeDefined()

		vi.advanceTimersByTime(DOUBLE_TAP_DELAY + 50)
		expect(deps.showControls).toHaveBeenCalledTimes(1)
	})

	it('shows controls on single tap when hidden', () => {
		deps.visible = false
		const handleTap = createTapHandler(deps, state)

		handleTap(195)
		vi.advanceTimersByTime(DOUBLE_TAP_DELAY + 50)

		expect(deps.showControls).toHaveBeenCalledTimes(1)
		expect(deps.hideControls).not.toHaveBeenCalled()
	})

	it('seeks backward on double-tap left third', () => {
		const handleTap = createTapHandler(deps, state)

		vi.setSystemTime(1000)
		handleTap(50)

		vi.setSystemTime(1100)
		handleTap(50)

		expect(deps.seek).toHaveBeenCalledWith(20)
		expect(deps.handleSeekIndicator).toHaveBeenCalledWith('left')
	})
})
