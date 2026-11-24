/**
 * Format a live-event start time (ISO/UTC) into a short tag label in the viewer's locale timezone.
 * Example: "2026-03-11T15:30:00Z" → "MAR 11, 3:30pm"
 * Returns null for missing/invalid input.
 */
export function formatEventStartLabel(iso?: string | null): string | null {
	if (!iso) return null
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return null

	const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date).toUpperCase()
	const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
		.format(date)
		.replace(/\s/g, '')
		.toLowerCase()

	return `${day}, ${time}`
}
