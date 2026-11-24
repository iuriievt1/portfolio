/**
 * Tests for PlaybackProvider polling logic.
 * Reimplemented as standalone setup to test without React hooks or expo-video.
 */

type MockPlayer = { playing: boolean; currentTime: number }
type PollingState = { isMounted: boolean; intervalId: ReturnType<typeof setInterval> | undefined; currentTime: number }

function setupPolling(player: MockPlayer | null, state: PollingState): (() => void) | undefined {
	if (!player || !player.playing) return undefined

	state.isMounted = true
	state.intervalId = setInterval(() => {
		if (!player.playing) {
			clearInterval(state.intervalId)
			state.intervalId = undefined
			return
		}
		if (state.isMounted) {
			state.currentTime = player.currentTime
		}
	}, 250)

	return () => {
		state.isMounted = false
		clearInterval(state.intervalId)
	}
}

describe('PlaybackProvider polling edge cases', () => {
	let player: MockPlayer
	let state: PollingState

	beforeEach(() => {
		vi.useFakeTimers()
		player = { playing: true, currentTime: 0 }
		state = { isMounted: false, intervalId: undefined, currentTime: 0 }
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('stops polling when player is paused', () => {
		const cleanup = setupPolling(player, state)

		player.currentTime = 5
		vi.advanceTimersByTime(250)
		expect(state.currentTime).toBe(5)

		player.playing = false
		vi.advanceTimersByTime(250) // interval self-clears

		player.playing = true
		player.currentTime = 42
		vi.advanceTimersByTime(250)

		// After self-clear, no more updates without re-setup
		expect(state.currentTime).not.toBe(42)

		cleanup?.()
	})

	it('does not poll when player is null', () => {
		const cleanup = setupPolling(null, state)
		expect(cleanup).toBeUndefined()
		expect(state.intervalId).toBeUndefined()
	})

	it('updates currentTime every 250ms while playing', () => {
		const cleanup = setupPolling(player, state)

		player.currentTime = 1
		vi.advanceTimersByTime(250)
		expect(state.currentTime).toBe(1)

		player.currentTime = 2
		vi.advanceTimersByTime(250)
		expect(state.currentTime).toBe(2)

		player.currentTime = 3
		vi.advanceTimersByTime(250)
		expect(state.currentTime).toBe(3)

		cleanup?.()
	})

	it('verifies polling rate is 250ms', () => {
		const cleanup = setupPolling(player, state)

		player.currentTime = 10
		vi.advanceTimersByTime(100)
		expect(state.currentTime).toBe(0) // not yet

		vi.advanceTimersByTime(150)
		expect(state.currentTime).toBe(10) // at 250ms

		cleanup?.()
	})

	it('clears interval on cleanup', () => {
		const clearSpy = vi.spyOn(globalThis, 'clearInterval')
		const cleanup = setupPolling(player, state)

		cleanup?.()

		expect(clearSpy).toHaveBeenCalledWith(state.intervalId)
		clearSpy.mockRestore()
	})
})
