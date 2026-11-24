/** Format seconds into mm:ss or h:mm:ss display string. Never signed — a negative reading reads as zero. */
export function formatTime(seconds: number): string {
	// The player reports NaN until it has metadata, and Math.max would carry it into the output.
	const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
	const h = Math.floor(s / 3600)
	const m = Math.floor((s % 3600) / 60)
	const sec = s % 60
	const mm = String(m).padStart(2, '0')
	const ss = String(sec).padStart(2, '0')
	return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * Format an epoch instant as a local 24-hour time of day — the label a live scrubber shows.
 *
 * Seconds are part of the label, not decoration: a DVR window can be narrower than a minute (the
 * multiview mosaic runs ~58s), which leaves the whole bar inside one minute and every hover
 * position reading the same time. Even on a 25h window one pixel spans over a minute, so a label
 * without seconds looks frozen against a playhead that is genuinely moving.
 */
export function formatClockTime(epochMs: number): string {
	if (!Number.isFinite(epochMs)) return '--:--:--'
	const d = new Date(epochMs)
	const hh = String(d.getHours()).padStart(2, '0')
	const mm = String(d.getMinutes()).padStart(2, '0')
	const ss = String(d.getSeconds()).padStart(2, '0')
	return `${hh}:${mm}:${ss}`
}
