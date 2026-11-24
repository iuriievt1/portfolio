import { describe, expect, it } from 'vitest'
import { clampVolume, displayVolume, volumeStateForLevel } from '../components/features/VideoPlayer/utils/volume'

describe('clampVolume', () => {
	it('keeps a level inside 0-100 and rounds to whole percent', () => {
		expect(clampVolume(50.4)).toBe(50)
		expect(clampVolume(150)).toBe(100)
		expect(clampVolume(-50)).toBe(0)
	})

	// Silence, not full blast: garbage input must never max the volume out.
	it('treats a non-finite level as silence rather than passing NaN to the SDK', () => {
		expect(clampVolume(Number.NaN)).toBe(0)
		expect(clampVolume(Number.POSITIVE_INFINITY)).toBe(0)
	})
})

describe('volumeStateForLevel', () => {
	const muted = { volume: 60, isMuted: true }

	it('clamps the dragged level', () => {
		expect(volumeStateForLevel({ volume: 20, isMuted: false }, 150).volume).toBe(100)
		expect(volumeStateForLevel({ volume: 20, isMuted: false }, -10).volume).toBe(0)
	})

	// Without this the thumb is pinned at zero by the very mute the drag is undoing.
	it('clears the mute when the level is raised above zero', () => {
		expect(volumeStateForLevel(muted, 40)).toEqual({ volume: 40, isMuted: false })
	})

	it('leaves the mute alone when the level lands on zero', () => {
		expect(volumeStateForLevel(muted, 0)).toEqual({ volume: 0, isMuted: true })
		expect(volumeStateForLevel({ volume: 60, isMuted: false }, 0)).toEqual({ volume: 0, isMuted: false })
	})

	it('ignores a non-finite level instead of resetting the slider', () => {
		expect(volumeStateForLevel(muted, Number.NaN)).toEqual(muted)
	})
})

describe('displayVolume', () => {
	// The reported bug: muted, but the slider kept painting the pre-mute level.
	it('paints nothing while muted, whatever the retained level is', () => {
		expect(displayVolume({ volume: 60, isMuted: true })).toBe(0)
	})

	it('paints the level when not muted', () => {
		expect(displayVolume({ volume: 60, isMuted: false })).toBe(60)
	})

	it('never paints outside the track', () => {
		expect(displayVolume({ volume: 150, isMuted: false })).toBe(100)
		expect(displayVolume({ volume: Number.NaN, isMuted: false })).toBe(0)
	})
})
