// Live programme timing comes from the AMP service (`defaultAccHostName`), which is the only
// place MK exposes it — `/v1/client/query` returns the catch-up slots for a channel and window.
// Discovery feeds, the channel map and the DVR proxy carry no programme times (see #72).

/** One slot as AMP reports it; both times are ISO UTC. */
export type AmpProgramme = {
	start_time?: string
	end_time?: string
}

export type AmpQueryResponse = {
	result?: string
	response?: { medias?: AmpProgramme[]; message?: string }
}

/** Start and end in epoch ms. */
export type ProgrammeWindow = { startMs: number; endMs: number }

/**
 * AMP is inconsistent about time formats: `/roll` returns `2026-08-19T11:30:00Z` while `/query`
 * returns `2026-08-19 11:30:00`. Both are UTC, but `Date.parse` reads the second as local time,
 * which would shift every slot by the viewer's offset.
 */
export function parseAmpTime(value?: string): number {
	const raw = value?.trim() ?? ''
	if (!raw) return Number.NaN
	const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(raw)
	return Date.parse(hasZone ? raw : `${raw.replace(' ', 'T')}Z`)
}

/** Parses a slot's times. Null when either end is missing, unparseable, or not a real window. */
export function toProgrammeWindow(programme: AmpProgramme): ProgrammeWindow | null {
	const startMs = parseAmpTime(programme.start_time)
	const endMs = parseAmpTime(programme.end_time)
	if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null
	return { startMs, endMs }
}

/**
 * Every usable slot in an AMP query response, oldest first. The card is handed the whole
 * schedule rather than one window, so a programme ending rolls into the next without a refetch.
 * Empty when AMP reported an error or had nothing to say.
 */
export function scheduleFromAmpQuery(body: AmpQueryResponse): ProgrammeWindow[] {
	if (body.result !== 'success') return []
	return (body.response?.medias ?? [])
		.map(toProgrammeWindow)
		.filter((window): window is ProgrammeWindow => window !== null)
		.sort((a, b) => a.startMs - b.startMs)
}
