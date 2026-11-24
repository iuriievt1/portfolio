import { describe, expect, it } from "vitest"
import { retryDelayMilliseconds } from "../retry-delay"

const LOWEST = () => 0
const HIGHEST = () => 1

describe("retry delay ADR-050 bod 10", () => {
	it("doubles with every attempt", () => {
		expect(retryDelayMilliseconds(1, HIGHEST)).toBe(5000)
		expect(retryDelayMilliseconds(2, HIGHEST)).toBe(10_000)
		expect(retryDelayMilliseconds(3, HIGHEST)).toBe(20_000)
	})

	it("spreads the delay between its half and its whole so retries do not meet", () => {
		expect(retryDelayMilliseconds(2, LOWEST)).toBe(5000)
		expect(retryDelayMilliseconds(2, HIGHEST)).toBe(10_000)
	})

	it("CAP-001-S34 keeps retrying with a delay that stops growing", () => {
		expect(retryDelayMilliseconds(40, HIGHEST)).toBe(15 * 60_000)
	})
})
