export type AiringWindow = { startMs: number; endMs: number }

/** The window covering `nowMs`, or null once the clock has run past the schedule we were given. */
export function currentAiring(schedule: AiringWindow[] | undefined, nowMs: number): AiringWindow | null {
	for (const window of schedule ?? []) {
		if (nowMs >= window.startMs && nowMs < window.endMs) return window
	}
	return null
}

/**
 * Elapsed share of whatever is on air. Undefined when nothing is — including after the last
 * known programme ends, so the bar disappears rather than sticking at full until a refetch.
 */
export function airingProgress(schedule: AiringWindow[] | undefined, nowMs: number): number | undefined {
	const window = currentAiring(schedule, nowMs)
	if (!window) return undefined
	return Math.min(Math.max((nowMs - window.startMs) / (window.endMs - window.startMs), 0), 1)
}
