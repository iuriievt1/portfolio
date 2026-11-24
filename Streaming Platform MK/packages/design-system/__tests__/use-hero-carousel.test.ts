import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHeroCarousel } from '../components/features/Hero/hooks/use-hero-carousel'

describe('useHeroCarousel', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe('initial state', () => {
		it('starts at active=0 with direction=1', () => {
			const { result } = renderHook(() => useHeroCarousel({ count: 5, autoPlayMs: 5000, paused: true }))

			expect(result.current.active).toBe(0)
			expect(result.current.direction).toBe(1)
			expect(result.current.progressKey).toBe(0)
		})
	})

	describe('goTo', () => {
		it('sets active to the given index', () => {
			const { result } = renderHook(() => useHeroCarousel({ count: 5, autoPlayMs: 5000, paused: true }))

			act(() => {
				result.current.goTo(2)
			})

			expect(result.current.active).toBe(2)
		})

		it('sets direction=1 when navigating forward', () => {
			const { result } = renderHook(() => useHeroCarousel({ count: 5, autoPlayMs: 5000, paused: true }))

			act(() => {
				result.current.goTo(2)
			})

			expect(result.current.direction).toBe(1)
		})

		it('sets direction=-1 when navigating backward', () => {
			const { result } = renderHook(() => useHeroCarousel({ count: 5, autoPlayMs: 5000, paused: true }))

			act(() => {
				result.current.goTo(3)
			})
			act(() => {
				result.current.goTo(0)
			})

			expect(result.current.active).toBe(0)
			expect(result.current.direction).toBe(-1)
		})

		it('wraps forward: goTo(count) wraps to 0', () => {
			const { result } = renderHook(() => useHeroCarousel({ count: 3, autoPlayMs: 5000, paused: true }))

			act(() => {
				result.current.goTo(3)
			})

			expect(result.current.active).toBe(0)
		})

		it('wraps backward: goTo(-1) wraps to count-1', () => {
			const { result } = renderHook(() => useHeroCarousel({ count: 4, autoPlayMs: 5000, paused: true }))

			act(() => {
				result.current.goTo(-1)
			})

			expect(result.current.active).toBe(3)
		})

		it('increments progressKey on each transition', () => {
			const { result } = renderHook(() => useHeroCarousel({ count: 5, autoPlayMs: 5000, paused: true }))

			expect(result.current.progressKey).toBe(0)

			act(() => {
				result.current.goTo(1)
			})
			expect(result.current.progressKey).toBe(1)

			act(() => {
				result.current.goTo(2)
			})
			expect(result.current.progressKey).toBe(2)

			act(() => {
				result.current.goTo(0)
			})
			expect(result.current.progressKey).toBe(3)
		})
	})

	describe('auto-play', () => {
		it('advances after autoPlayMs', () => {
			const { result } = renderHook(() => useHeroCarousel({ count: 5, autoPlayMs: 3000, paused: false }))

			expect(result.current.active).toBe(0)

			act(() => {
				vi.advanceTimersByTime(3000)
			})

			expect(result.current.active).toBe(1)
		})

		it('advances repeatedly', () => {
			const { result } = renderHook(() => useHeroCarousel({ count: 5, autoPlayMs: 1000, paused: false }))

			act(() => {
				vi.advanceTimersByTime(1000)
			})
			expect(result.current.active).toBe(1)

			act(() => {
				vi.advanceTimersByTime(1000)
			})
			expect(result.current.active).toBe(2)

			act(() => {
				vi.advanceTimersByTime(1000)
			})
			expect(result.current.active).toBe(3)
		})

		it('wraps around at the end', () => {
			const { result } = renderHook(() => useHeroCarousel({ count: 3, autoPlayMs: 1000, paused: false }))

			act(() => {
				vi.advanceTimersByTime(3000)
			})

			expect(result.current.active).toBe(0)
		})

		it('does not advance when paused=true', () => {
			const { result } = renderHook(() => useHeroCarousel({ count: 5, autoPlayMs: 1000, paused: true }))

			act(() => {
				vi.advanceTimersByTime(5000)
			})

			expect(result.current.active).toBe(0)
		})

		it('does not auto-play with single item (count=1)', () => {
			const { result } = renderHook(() => useHeroCarousel({ count: 1, autoPlayMs: 1000, paused: false }))

			act(() => {
				vi.advanceTimersByTime(5000)
			})

			expect(result.current.active).toBe(0)
		})

		it('interval continues independently of manual goTo', () => {
			// The auto-play effect depends on [count, autoPlayMs, paused], NOT active.
			// So a manual goTo changes active but does not reset the interval timer.
			const { result } = renderHook(() => useHeroCarousel({ count: 5, autoPlayMs: 1000, paused: false }))

			// Advance 500ms (halfway through interval)
			act(() => {
				vi.advanceTimersByTime(500)
			})
			expect(result.current.active).toBe(0)

			// Manual goTo changes active
			act(() => {
				result.current.goTo(3)
			})
			expect(result.current.active).toBe(3)

			// At 1000ms total the interval fires, advancing from current active (3) to 4
			act(() => {
				vi.advanceTimersByTime(500)
			})
			expect(result.current.active).toBe(4)
		})

		it('sets direction=1 during auto-play', () => {
			const { result } = renderHook(() => useHeroCarousel({ count: 5, autoPlayMs: 1000, paused: false }))

			act(() => {
				vi.advanceTimersByTime(1000)
			})

			expect(result.current.direction).toBe(1)
		})

		it('increments progressKey during auto-play', () => {
			const { result } = renderHook(() => useHeroCarousel({ count: 5, autoPlayMs: 1000, paused: false }))

			expect(result.current.progressKey).toBe(0)

			act(() => {
				vi.advanceTimersByTime(1000)
			})
			expect(result.current.progressKey).toBe(1)

			act(() => {
				vi.advanceTimersByTime(1000)
			})
			expect(result.current.progressKey).toBe(2)
		})

		it('stops auto-play when paused changes to true', () => {
			const { result, rerender } = renderHook(({ paused }) => useHeroCarousel({ count: 5, autoPlayMs: 1000, paused }), {
				initialProps: { paused: false },
			})

			act(() => {
				vi.advanceTimersByTime(1000)
			})
			expect(result.current.active).toBe(1)

			rerender({ paused: true })

			act(() => {
				vi.advanceTimersByTime(5000)
			})
			expect(result.current.active).toBe(1)
		})

		it('resumes auto-play when paused changes to false', () => {
			const { result, rerender } = renderHook(({ paused }) => useHeroCarousel({ count: 5, autoPlayMs: 1000, paused }), {
				initialProps: { paused: true },
			})

			act(() => {
				vi.advanceTimersByTime(3000)
			})
			expect(result.current.active).toBe(0)

			rerender({ paused: false })

			act(() => {
				vi.advanceTimersByTime(1000)
			})
			expect(result.current.active).toBe(1)
		})
	})
})
