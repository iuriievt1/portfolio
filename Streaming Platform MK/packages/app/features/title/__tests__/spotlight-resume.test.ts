import { describe, expect, it } from 'vitest'
import { type ResumeState, spotlightResume } from '../spotlight-resume'

const state = (overrides: Partial<ResumeState> = {}): ResumeState => ({
	pending: 120,
	isLive: false,
	isPlaying: true,
	currentTime: 1.2,
	...overrides,
})

describe('spotlightResume', () => {
	it('restores the playhead once the reloaded recording is running', () => {
		expect(spotlightResume(state())).toEqual({ action: 'seek', time: 120 })
	})

	it('waits while the reloaded stream has not started ticking', () => {
		expect(spotlightResume(state({ currentTime: 0 }))).toEqual({ action: 'wait' })
		expect(spotlightResume(state({ isPlaying: false }))).toEqual({ action: 'wait' })
	})

	it('has nothing to do without a remembered position', () => {
		expect(spotlightResume(state({ pending: null }))).toEqual({ action: 'wait' })
	})

	// A live viewer expects the edge, and the variants' sliding windows need not line up.
	it('leaves live playback at the edge', () => {
		expect(spotlightResume(state({ isLive: true }))).toEqual({ action: 'drop' })
		expect(spotlightResume(state({ isLive: true, currentTime: 0 }))).toEqual({ action: 'drop' })
	})

	it('drops a position at or before the start rather than seeking to it', () => {
		expect(spotlightResume(state({ pending: 0 }))).toEqual({ action: 'drop' })
		expect(spotlightResume(state({ pending: -5 }))).toEqual({ action: 'drop' })
	})

	// For a beat after the switch the playhead still reads from the player being torn down, sitting
	// exactly at the position we mean to return to. Acting on it would skip the restore entirely.
	it('keeps waiting while the playhead still reads from the outgoing stream', () => {
		expect(spotlightResume(state({ currentTime: 120 }))).toEqual({ action: 'wait' })
		expect(spotlightResume(state({ currentTime: 300 }))).toEqual({ action: 'wait' })
	})

	it('restores once the reloaded stream has restarted from the top', () => {
		// The playhead has come back below the target — the new variant is genuinely running.
		expect(spotlightResume(state({ currentTime: 0.4 }))).toEqual({ action: 'seek', time: 120 })
		expect(spotlightResume(state({ currentTime: 119.9 }))).toEqual({ action: 'seek', time: 120 })
	})
})
