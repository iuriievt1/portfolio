import { type DayInterval, REGISTRY_QUERY_OUTCOME, type RegistryQueryResult } from "../ports/registry-source.port"
import { halvesOf } from "./day-interval"

export interface CollectedMatches<T> {
	matches: T[]
	isComplete: boolean
	characterSetMissing: boolean
}

type IntervalQuery<T> = (interval: DayInterval) => Promise<RegistryQueryResult<T>>

function combined<T>(first: CollectedMatches<T>, second: CollectedMatches<T>): CollectedMatches<T> {
	return {
		matches: [...first.matches, ...second.matches],
		isComplete: first.isComplete && second.isComplete,
		characterSetMissing: first.characterSetMissing || second.characterSetMissing,
	}
}

// CAP-024-R08, CAP-024-R14, CAP-024-S03
export async function collectByInterval<T>(
	query: IntervalQuery<T>,
	interval: DayInterval,
): Promise<CollectedMatches<T>> {
	const result = await query(interval)
	const collected: CollectedMatches<T> = {
		matches: [...result.matches],
		isComplete: result.outcome === REGISTRY_QUERY_OUTCOME.COMPLETE,
		characterSetMissing: result.characterSetMissing,
	}
	if (result.outcome !== REGISTRY_QUERY_OUTCOME.TOO_MANY_MATCHES) {
		return collected
	}
	const halves = halvesOf(interval)
	if (halves === undefined) {
		return collected
	}
	const [first, second] = halves
	return combined(await collectByInterval(query, first), await collectByInterval(query, second))
}
