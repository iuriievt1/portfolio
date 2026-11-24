/**
 * Format seconds into a human-readable duration string.
 * Examples: 7200 → "2h", 5400 → "1h 30m", 300 → "5m"
 */
export function formatDuration(seconds: number): string {
	const h = Math.floor(seconds / 3600)
	const m = Math.round((seconds % 3600) / 60)
	if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
	return `${m}m`
}
