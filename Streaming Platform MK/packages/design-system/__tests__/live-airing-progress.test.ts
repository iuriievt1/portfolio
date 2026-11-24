import { describe, expect, it } from 'vitest'
import { airingProgress, currentAiring } from '../components/features/Rail/Card/live-progress'

const at = (iso: string) => Date.parse(iso)
// Half-hour then hour slots, the shape AMP returns for these channels.
const SCHEDULE = [
	{ startMs: at('2026-08-19T11:00:00Z'), endMs: at('2026-08-19T11:30:00Z') },
	{ startMs: at('2026-08-19T11:30:00Z'), endMs: at('2026-08-19T12:00:00Z') },
	{ startMs: at('2026-08-19T12:00:00Z'), endMs: at('2026-08-19T13:00:00Z') },
]

describe('currentAiring', () => {
	it('picks the window covering now', () => {
		expect(currentAiring(SCHEDULE, at('2026-08-19T11:45:00Z'))?.endMs).toBe(at('2026-08-19T12:00:00Z'))
	})

	it('hands the boundary to the incoming window', () => {
		expect(currentAiring(SCHEDULE, at('2026-08-19T12:00:00Z'))?.endMs).toBe(at('2026-08-19T13:00:00Z'))
	})

	it('is null outside the schedule and for no schedule at all', () => {
		expect(currentAiring(SCHEDULE, at('2026-08-19T09:00:00Z'))).toBeNull()
		expect(currentAiring(undefined, at('2026-08-19T11:45:00Z'))).toBeNull()
	})
})

describe('airingProgress', () => {
	it('advances through a window as the clock moves', () => {
		expect(airingProgress(SCHEDULE, at('2026-08-19T11:30:00Z'))).toBe(0)
		expect(airingProgress(SCHEDULE, at('2026-08-19T11:45:00Z'))).toBe(0.5)
		expect(airingProgress(SCHEDULE, at('2026-08-19T11:59:00Z'))).toBeCloseTo(29 / 30)
	})

	// The whole point of holding the schedule: the bar restarts on its own at the handover.
	it('resets when one programme rolls into the next', () => {
		expect(airingProgress(SCHEDULE, at('2026-08-19T11:59:00Z'))).toBeGreaterThan(0.9)
		expect(airingProgress(SCHEDULE, at('2026-08-19T12:01:00Z'))).toBeCloseTo(1 / 60)
	})

	// Sticking at full would claim a programme is still running when we simply do not know.
	it('is undefined once the schedule runs out, not stuck at full', () => {
		expect(airingProgress(SCHEDULE, at('2026-08-19T13:30:00Z'))).toBeUndefined()
	})
})
