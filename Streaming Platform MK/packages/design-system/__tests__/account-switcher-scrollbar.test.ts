import { describe, expect, it } from 'vitest'
import { measureScroll, scrollTopForPointer } from '../components/ui/AccountSwitcher/scrollbar'

describe('measureScroll', () => {
	it('reports no overflow when the content fits', () => {
		expect(measureScroll({ scrollTop: 0, scrollHeight: 346, clientHeight: 405 })).toEqual({
			overflows: false,
			ratio: 1,
			progress: 0,
		})
	})

	it('reports no overflow when content and region are the same height', () => {
		expect(measureScroll({ scrollTop: 0, scrollHeight: 405, clientHeight: 405 }).overflows).toBe(false)
	})

	// Fractional row heights make browsers report a scrollHeight a hair taller than
	// the region — that must not light up a scrollbar for a list that visibly fits.
	it('ignores sub-pixel overflow', () => {
		expect(measureScroll({ scrollTop: 0, scrollHeight: 405.4, clientHeight: 405 }).overflows).toBe(false)
	})

	it('measures the thumb from the visible fraction', () => {
		const { overflows, ratio } = measureScroll({ scrollTop: 0, scrollHeight: 523, clientHeight: 405 })
		expect(overflows).toBe(true)
		expect(ratio).toBeCloseTo(405 / 523, 5)
	})

	it('tracks progress from top to bottom', () => {
		const at = (scrollTop: number) => measureScroll({ scrollTop, scrollHeight: 523, clientHeight: 405 }).progress
		expect(at(0)).toBe(0)
		expect(at(59)).toBeCloseTo(0.5, 5)
		expect(at(118)).toBe(1)
	})

	it('clamps progress when the browser overscrolls', () => {
		expect(measureScroll({ scrollTop: -20, scrollHeight: 523, clientHeight: 405 }).progress).toBe(0)
		expect(measureScroll({ scrollTop: 999, scrollHeight: 523, clientHeight: 405 }).progress).toBe(1)
	})

	it('survives a collapsed or unmeasured region', () => {
		expect(measureScroll({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 })).toEqual({
			overflows: false,
			ratio: 1,
			progress: 0,
		})
		expect(measureScroll({ scrollTop: 0, scrollHeight: Number.NaN, clientHeight: 405 }).overflows).toBe(false)
	})
})

describe('scrollTopForPointer', () => {
	const track = { trackTop: 100, trackHeight: 400 }
	const content = { scrollHeight: 800, clientHeight: 400 }
	// ratio 0.5 → 200px thumb, 200px of travel, 400px of scrollable content.

	it('maps a grab at the top of the track to the top of the list', () => {
		expect(scrollTopForPointer({ ...track, ...content, ratio: 0.5, pointerY: 100, grabOffset: 0 })).toBe(0)
	})

	it('maps a grab at the end of the travel to the bottom of the list', () => {
		expect(scrollTopForPointer({ ...track, ...content, ratio: 0.5, pointerY: 300, grabOffset: 0 })).toBe(400)
	})

	it('keeps the thumb under the cursor via the grab offset', () => {
		// Grabbed 100px down the thumb, cursor now 150px down the track.
		expect(scrollTopForPointer({ ...track, ...content, ratio: 0.5, pointerY: 250, grabOffset: 100 })).toBe(100)
	})

	it('clamps outside the track instead of overscrolling', () => {
		expect(scrollTopForPointer({ ...track, ...content, ratio: 0.5, pointerY: -500, grabOffset: 0 })).toBe(0)
		expect(scrollTopForPointer({ ...track, ...content, ratio: 0.5, pointerY: 5000, grabOffset: 0 })).toBe(400)
	})

	it('stays at the top when the thumb fills the track', () => {
		expect(scrollTopForPointer({ ...track, ...content, ratio: 1, pointerY: 300, grabOffset: 0 })).toBe(0)
	})
})
