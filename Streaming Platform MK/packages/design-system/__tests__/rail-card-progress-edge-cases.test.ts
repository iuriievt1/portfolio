/**
 * Tests for CardProgress extraction logic.
 * Verifies safe access and clamping of progress values from rail items.
 */
import { describe, expect, it } from 'vitest'

type AnyItem = { variant: string; progress?: number; live?: { channel: string; show: string; progress: number } }

function extractProgress(item: AnyItem): number | undefined {
	let value: number | undefined
	if (item.variant === 'continue') value = item.progress
	if (item.variant === 'live') value = item.live?.progress

	if (value != null) {
		if (Number.isNaN(value)) value = 0
		value = Math.min(Math.max(value, 0), 1)
	}

	return value
}

describe('CardProgress extraction logic', () => {
	it('does not crash when live variant has undefined live data', () => {
		const malformedLiveItem = { variant: 'live' as const, live: undefined }
		expect(() => extractProgress(malformedLiveItem as unknown as AnyItem)).not.toThrow()
	})

	it('guards against NaN progress on continue items', () => {
		const item: AnyItem = { variant: 'continue', progress: NaN }
		const value = extractProgress(item)
		expect(value === undefined || (typeof value === 'number' && !Number.isNaN(value))).toBe(true)
	})

	it('clamps progress > 1 from API data', () => {
		const item: AnyItem = { variant: 'continue', progress: 1.5 }
		expect(extractProgress(item)).toBeLessThanOrEqual(1)
	})

	it('clamps live progress > 1 from API data', () => {
		const item: AnyItem = {
			variant: 'live',
			live: { channel: 'CH1', show: 'Show', progress: 2.0 },
		}
		expect(extractProgress(item)).toBeLessThanOrEqual(1)
	})

	it('extracts continue progress correctly for valid data', () => {
		expect(extractProgress({ variant: 'continue', progress: 0.75 })).toBe(0.75)
	})

	it('extracts live progress correctly for valid data', () => {
		const item: AnyItem = { variant: 'live', live: { channel: 'CH1', show: 'Show', progress: 0.5 } }
		expect(extractProgress(item)).toBe(0.5)
	})

	it('returns undefined for non-progress variants', () => {
		expect(extractProgress({ variant: 'poster' })).toBeUndefined()
	})
})
