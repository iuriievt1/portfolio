import { describe, expect, it } from 'vitest'
import { type AmpProgramme, parseAmpTime, scheduleFromAmpQuery, toProgrammeWindow } from '../live-progress'

// Real slots from `/v1/client/query?channelId=engage1`, which come back newest first.
const SLOTS: AmpProgramme[] = [
	{ start_time: '2026-08-19 12:00:00', end_time: '2026-08-19 13:00:00' },
	{ start_time: '2026-08-19 11:30:00', end_time: '2026-08-19 12:00:00' },
	{ start_time: '2026-08-19 11:00:00', end_time: '2026-08-19 11:30:00' },
]
const at = (iso: string) => Date.parse(iso)

describe('parseAmpTime', () => {
	// /roll answers with a zone, /query without one — and both mean UTC.
	it('reads both AMP formats as UTC', () => {
		expect(parseAmpTime('2026-08-19T11:30:00Z')).toBe(Date.UTC(2026, 7, 19, 11, 30))
		expect(parseAmpTime('2026-08-19 11:30:00')).toBe(Date.UTC(2026, 7, 19, 11, 30))
	})

	it('keeps an explicit offset instead of forcing UTC on it', () => {
		expect(parseAmpTime('2026-08-19T13:30:00+02:00')).toBe(Date.UTC(2026, 7, 19, 11, 30))
	})

	it('is NaN for a missing or unusable value', () => {
		expect(parseAmpTime(undefined)).toBeNaN()
		expect(parseAmpTime('')).toBeNaN()
		expect(parseAmpTime('later')).toBeNaN()
	})
})

describe('toProgrammeWindow', () => {
	it('parses a slot', () => {
		expect(toProgrammeWindow(SLOTS[1])).toEqual({
			startMs: at('2026-08-19T11:30:00Z'),
			endMs: at('2026-08-19T12:00:00Z'),
		})
	})

	it('rejects a slot that is missing, unparseable, or inside out', () => {
		expect(toProgrammeWindow({})).toBeNull()
		expect(toProgrammeWindow({ start_time: 'soon', end_time: 'later' })).toBeNull()
		expect(toProgrammeWindow({ start_time: '2026-08-19T12:00:00Z', end_time: '2026-08-19T11:00:00Z' })).toBeNull()
	})
})

describe('scheduleFromAmpQuery', () => {
	it('returns every usable slot, oldest first', () => {
		const schedule = scheduleFromAmpQuery({ result: 'success', response: { medias: SLOTS } })

		expect(schedule.map((w) => new Date(w.startMs).toISOString())).toEqual([
			'2026-08-19T11:00:00.000Z',
			'2026-08-19T11:30:00.000Z',
			'2026-08-19T12:00:00.000Z',
		])
	})

	it('drops slots it cannot parse rather than failing the rail', () => {
		const medias = [...SLOTS, { start_time: 'soon' }, {}]
		expect(scheduleFromAmpQuery({ result: 'success', response: { medias } })).toHaveLength(3)
	})

	// AMP answers 200 with result:"error" — e.g. a rejected device profile header.
	it('is empty when AMP reports an error or has nothing', () => {
		expect(scheduleFromAmpQuery({ result: 'error', response: { message: 'no profile' } })).toEqual([])
		expect(scheduleFromAmpQuery({ result: 'success', response: { medias: [] } })).toEqual([])
	})
})
