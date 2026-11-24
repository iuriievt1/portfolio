import { describe, expect, it } from 'vitest'
import { formatClockTime, formatTime } from '../components/features/VideoPlayer/utils/format-time'

describe('formatTime', () => {
	it('pads seconds under a minute', () => {
		expect(formatTime(17)).toBe('00:17')
	})

	it('formats minutes and seconds without an hour part', () => {
		expect(formatTime(3125)).toBe('52:05')
	})

	it('adds the hour part once past an hour', () => {
		expect(formatTime(3723)).toBe('1:02:03')
	})

	it('never emits a sign — a negative reading clamps to zero', () => {
		expect(formatTime(-17)).toBe('00:00')
		expect(formatTime(-0.4)).toBe('00:00')
	})

	it('truncates sub-second values rather than rounding up', () => {
		expect(formatTime(59.9)).toBe('00:59')
	})

	it('handles zero', () => {
		expect(formatTime(0)).toBe('00:00')
	})

	it('survives a NaN duration from a player that has not loaded metadata', () => {
		expect(formatTime(Number.NaN)).toBe('00:00')
	})
})

describe('formatClockTime', () => {
	const at = (h: number, m: number, s = 0) => new Date(2026, 7, 22, h, m, s).getTime()

	it('renders the local time of day as HH:MM:SS', () => {
		expect(formatClockTime(at(15, 47, 32))).toBe('15:47:32')
	})

	it('zero-pads every part', () => {
		expect(formatClockTime(at(9, 5, 3))).toBe('09:05:03')
	})

	it('renders midnight as 00:00:00, not 24:00:00', () => {
		expect(formatClockTime(at(0, 0))).toBe('00:00:00')
	})

	it('separates two instants a few seconds apart', () => {
		// The multiview DVR window is ~58s wide, so the whole scrubber sits inside one minute.
		// Without seconds every position on that bar renders the same label.
		expect(formatClockTime(at(15, 47, 2))).not.toBe(formatClockTime(at(15, 47, 16)))
	})

	it('truncates sub-second values rather than rounding the second up', () => {
		expect(formatClockTime(at(15, 47, 59) + 900)).toBe('15:47:59')
	})

	it('falls back to a placeholder when the instant is unknown', () => {
		expect(formatClockTime(Number.NaN)).toBe('--:--:--')
		expect(formatClockTime(Number.POSITIVE_INFINITY)).toBe('--:--:--')
	})
})
