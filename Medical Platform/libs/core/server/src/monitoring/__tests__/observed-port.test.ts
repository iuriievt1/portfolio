import { DEPENDENCY_STATE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { DependencyObservation } from "../dependency-observation"
import { observedPort } from "../observed-port"

class UnreachableError extends Error {}
class RefusedError extends Error {}

const CHECKS = {
	isUnavailability: (error: unknown) => error instanceof UnreachableError,
	isAnswer: (error: unknown) => error instanceof RefusedError,
}

interface Port {
	record(value: string): Promise<string>
}

function portThat(record: (value: string) => Promise<string>): { port: Port; observation: DependencyObservation } {
	const observation = new DependencyObservation()
	return { port: observedPort<Port>({ record }, observation, CHECKS), observation }
}

describe("observedPort", () => {
	it("CAP-028-R20 sees the dependency available when it answers", async () => {
		const { port, observation } = portThat(async (value) => `stored ${value}`)

		expect(await port.record("a")).toBe("stored a")
		expect(observation.state()).toBe(DEPENDENCY_STATE.AVAILABLE)
	})

	it("CAP-028-S09 sees the dependency unavailable when the call cannot reach it", async () => {
		const { port, observation } = portThat(async () => Promise.reject(new UnreachableError("down")))

		await expect(port.record("a")).rejects.toBeInstanceOf(UnreachableError)
		expect(observation.state()).toBe(DEPENDENCY_STATE.UNAVAILABLE)
	})

	it("counts a refused call as an answer of the dependency", async () => {
		const { port, observation } = portThat(async () => Promise.reject(new RefusedError("422")))
		observation.recordUnavailability(Date.now())

		await expect(port.record("a")).rejects.toBeInstanceOf(RefusedError)
		expect(observation.state()).toBe(DEPENDENCY_STATE.AVAILABLE)
	})

	it("leaves the members every object has untouched", () => {
		const { port, observation } = portThat(async (value) => value)

		expect(String(port)).toBe("[object Object]")
		expect(Object.hasOwn(port, "record")).toBe(true)
		expect(observation.state()).toBe(DEPENDENCY_STATE.UNKNOWN)
	})

	it("learns nothing from an error that did not come from the dependency", async () => {
		const { port, observation } = portThat(async () => Promise.reject(new TypeError("bug")))

		await expect(port.record("a")).rejects.toThrow("bug")
		expect(observation.state()).toBe(DEPENDENCY_STATE.UNKNOWN)
	})
})
