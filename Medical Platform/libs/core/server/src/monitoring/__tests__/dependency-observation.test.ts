import { DEPENDENCY_STATE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { DependencyObservation } from "../dependency-observation"

const STARTED_AT = Date.UTC(2026, 9, 27, 8, 0, 0)
const MINUTE = 60_000

describe("DependencyObservation", () => {
	it("CAP-028-R20 knows nothing until the process calls the dependency", () => {
		const observation = new DependencyObservation()

		expect(observation.state()).toBe(DEPENDENCY_STATE.UNKNOWN)
		expect(observation.outageSeconds()).toBeUndefined()
	})

	it("CAP-028-S09 measures an outage from the first to the last failed call", () => {
		const observation = new DependencyObservation()

		observation.recordUnavailability(STARTED_AT)
		observation.recordUnavailability(STARTED_AT + 2 * MINUTE)
		observation.recordUnavailability(STARTED_AT + 7 * MINUTE)

		expect(observation.state()).toBe(DEPENDENCY_STATE.UNAVAILABLE)
		expect(observation.unavailableSince()).toBe(STARTED_AT)
		expect(observation.outageSeconds()).toBe(420)
	})

	it("ends the outage with the first answer", () => {
		const observation = new DependencyObservation()
		observation.recordUnavailability(STARTED_AT)

		observation.recordAnswer()
		observation.recordUnavailability(STARTED_AT + MINUTE)

		expect(observation.unavailableSince()).toBe(STARTED_AT + MINUTE)
		expect(observation.outageSeconds()).toBe(0)
	})
})
