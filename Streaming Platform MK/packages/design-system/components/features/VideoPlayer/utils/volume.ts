export type VolumeState = { volume: number; isMuted: boolean }

/** Volume the SDK accepts: whole percent, 0-100. */
export function clampVolume(value: number): number {
	if (!Number.isFinite(value)) return 0
	return Math.max(0, Math.min(100, Math.round(value)))
}

/**
 * State after the user drags the slider. Raising the level clears the mute, so the thumb is not
 * pinned at zero by the very mute the drag is undoing (#62).
 */
export function volumeStateForLevel(current: VolumeState, level: number): VolumeState {
	if (!Number.isFinite(level)) return current
	const volume = clampVolume(level)
	return { volume, isMuted: volume === 0 ? current.isMuted : false }
}

/** Level the slider paints. Muted always reads as empty, so the icon and the fill agree (#62). */
export function displayVolume({ volume, isMuted }: VolumeState): number {
	return isMuted ? 0 : clampVolume(volume)
}
