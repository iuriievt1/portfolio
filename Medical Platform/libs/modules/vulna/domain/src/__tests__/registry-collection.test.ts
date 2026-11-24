import { describe, expect, it } from "vitest"
import { type DayInterval, REGISTRY_QUERY_OUTCOME, type RegistryQueryOutcome } from "../ports/registry-source.port"
import { collectByInterval } from "../registry/registry-collection"

const WEEK: DayInterval = { from: "2026-10-01", to: "2026-10-07" }

function answering(outcomeOf: (interval: DayInterval) => RegistryQueryOutcome) {
	const asked: DayInterval[] = []
	const query = async (interval: DayInterval) => {
		asked.push(interval)
		return { outcome: outcomeOf(interval), matches: [interval.from], characterSetMissing: false }
	}
	return { asked, query }
}

describe("collecting a registry query CAP-024-R14", () => {
	it("keeps a complete answer as it is", async () => {
		const source = answering(() => REGISTRY_QUERY_OUTCOME.COMPLETE)

		const collected = await collectByInterval(source.query, WEEK)

		expect(collected).toEqual({ matches: ["2026-10-01"], isComplete: true, characterSetMissing: false })
		expect(source.asked).toEqual([WEEK])
	})

	it("CAP-024-S03 halves the interval after too many matches and stays complete", async () => {
		const source = answering((interval) =>
			interval === WEEK ? REGISTRY_QUERY_OUTCOME.TOO_MANY_MATCHES : REGISTRY_QUERY_OUTCOME.COMPLETE,
		)

		const collected = await collectByInterval(source.query, WEEK)

		expect(collected.isComplete).toBe(true)
		expect(collected.matches).toEqual(["2026-10-01", "2026-10-04"])
	})

	it("CAP-024-S03 marks the result incomplete when even one day has too many matches", async () => {
		const source = answering(() => REGISTRY_QUERY_OUTCOME.TOO_MANY_MATCHES)

		const collected = await collectByInterval(source.query, WEEK)

		expect(collected.isComplete).toBe(false)
		expect(source.asked.at(-1)).toEqual({ from: "2026-10-07", to: "2026-10-07" })
		expect(collected.matches).toHaveLength(7)
	})

	it("CAP-024-S02 does not halve an interrupted query and marks it incomplete", async () => {
		const source = answering(() => REGISTRY_QUERY_OUTCOME.INCOMPLETE)

		const collected = await collectByInterval(source.query, WEEK)

		expect(collected.isComplete).toBe(false)
		expect(source.asked).toEqual([WEEK])
	})

	it("CAP-024-R11 carries a missing character set up from any half", async () => {
		let calls = 0
		const collected = await collectByInterval(async () => {
			calls += 1
			return {
				outcome: calls === 1 ? REGISTRY_QUERY_OUTCOME.TOO_MANY_MATCHES : REGISTRY_QUERY_OUTCOME.COMPLETE,
				matches: [],
				characterSetMissing: calls === 3,
			}
		}, WEEK)

		expect(collected.characterSetMissing).toBe(true)
	})
})
