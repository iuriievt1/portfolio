/**
 * Validates and normalises a route parameter from Expo Router / Next.js.
 *
 * Deep links and query strings can produce `undefined`, empty strings,
 * whitespace-only strings, or `string[]` values. This function collapses
 * all invalid shapes to `null` and extracts the first element from arrays.
 */
export function validateRouteParam(value: string | string[] | undefined): string | null {
	if (value === undefined) return null

	const raw = Array.isArray(value) ? value[0] : value

	if (raw === undefined) return null

	const trimmed = raw.trim()
	return trimmed.length > 0 ? trimmed : null
}
