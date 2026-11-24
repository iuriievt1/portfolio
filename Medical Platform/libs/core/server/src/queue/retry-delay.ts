const FIRST_DELAY_MILLISECONDS = 5000
const LONGEST_DELAY_MILLISECONDS = 15 * 60_000
const GROWTH = 2

// ADR-050 bod 10
export function retryDelayMilliseconds(attempts: number, random: () => number = Math.random): number {
	const exponent = Math.max(0, attempts - 1)
	const delay = Math.min(LONGEST_DELAY_MILLISECONDS, FIRST_DELAY_MILLISECONDS * GROWTH ** exponent)
	const halfDelay = delay / 2
	return Math.round(halfDelay + random() * halfDelay)
}
