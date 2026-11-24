import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIdleTimer } from '../components/features/VideoPlayer/hooks/use-idle-timer'

describe('useIdleTimer', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('returns startTimer and clearTimer functions', () => {
		const onIdle = vi.fn()
		const { result } = renderHook(() => useIdleTimer(3000, onIdle))

		expect(typeof result.current.startTimer).toBe('function')
		expect(typeof result.current.clearTimer).toBe('function')
	})

	it('does not fire callback on mount (no auto-start)', () => {
		const onIdle = vi.fn()
		renderHook(() => useIdleTimer(3000, onIdle))

		act(() => {
			vi.advanceTimersByTime(5000)
		})

		expect(onIdle).not.toHaveBeenCalled()
	})

	it('fires callback after timeout when startTimer is called', () => {
		const onIdle = vi.fn()
		const { result } = renderHook(() => useIdleTimer(3000, onIdle))

		act(() => {
			result.current.startTimer()
		})

		expect(onIdle).not.toHaveBeenCalled()

		act(() => {
			vi.advanceTimersByTime(3000)
		})

		expect(onIdle).toHaveBeenCalledTimes(1)
	})

	it('does not fire callback before timeout elapses', () => {
		const onIdle = vi.fn()
		const { result } = renderHook(() => useIdleTimer(3000, onIdle))

		act(() => {
			result.current.startTimer()
		})

		act(() => {
			vi.advanceTimersByTime(2999)
		})

		expect(onIdle).not.toHaveBeenCalled()
	})

	it('clearTimer prevents callback from firing', () => {
		const onIdle = vi.fn()
		const { result } = renderHook(() => useIdleTimer(3000, onIdle))

		act(() => {
			result.current.startTimer()
		})

		act(() => {
			vi.advanceTimersByTime(1000)
		})

		act(() => {
			result.current.clearTimer()
		})

		act(() => {
			vi.advanceTimersByTime(5000)
		})

		expect(onIdle).not.toHaveBeenCalled()
	})

	it('startTimer resets an existing timer', () => {
		const onIdle = vi.fn()
		const { result } = renderHook(() => useIdleTimer(3000, onIdle))

		act(() => {
			result.current.startTimer()
		})

		// Advance 2000ms
		act(() => {
			vi.advanceTimersByTime(2000)
		})
		expect(onIdle).not.toHaveBeenCalled()

		// Reset timer
		act(() => {
			result.current.startTimer()
		})

		// After another 2000ms — old timer would have fired at 3000, but was reset
		act(() => {
			vi.advanceTimersByTime(2000)
		})
		expect(onIdle).not.toHaveBeenCalled()

		// After the full 3000ms from reset, it fires
		act(() => {
			vi.advanceTimersByTime(1000)
		})
		expect(onIdle).toHaveBeenCalledTimes(1)
	})

	it('clearTimer is safe to call when no timer is active', () => {
		const onIdle = vi.fn()
		const { result } = renderHook(() => useIdleTimer(3000, onIdle))

		expect(() => {
			act(() => {
				result.current.clearTimer()
			})
		}).not.toThrow()
	})

	it('clearTimer is safe to call multiple times', () => {
		const onIdle = vi.fn()
		const { result } = renderHook(() => useIdleTimer(3000, onIdle))

		act(() => {
			result.current.startTimer()
		})

		expect(() => {
			act(() => {
				result.current.clearTimer()
				result.current.clearTimer()
			})
		}).not.toThrow()

		act(() => {
			vi.advanceTimersByTime(5000)
		})
		expect(onIdle).not.toHaveBeenCalled()
	})

	it('works with different timeout values', () => {
		const onIdle = vi.fn()
		const { result } = renderHook(() => useIdleTimer(500, onIdle))

		act(() => {
			result.current.startTimer()
		})

		act(() => {
			vi.advanceTimersByTime(500)
		})

		expect(onIdle).toHaveBeenCalledTimes(1)
	})
})
