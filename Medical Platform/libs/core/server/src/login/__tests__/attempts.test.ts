import { describe, expect, it } from "vitest"
import {
	attemptsExhausted,
	MAX_ATTEMPT_DELAY_SECONDS,
	nextAttemptDelaySeconds,
	remainingDelaySeconds,
} from "../attempts"

const NOW = new Date("2026-09-30T10:00:00.000Z")

describe("failed attempts", () => {
	it("CAP-001-S07 exhausts the attempts at the configured limit", () => {
		expect(attemptsExhausted(4, 5)).toBe(false)
		expect(attemptsExhausted(5, 5)).toBe(true)
	})

	it("doubles the delay from the base and stops at one minute", () => {
		expect(nextAttemptDelaySeconds(0, 1)).toBe(0)
		expect(nextAttemptDelaySeconds(1, 1)).toBe(1)
		expect(nextAttemptDelaySeconds(3, 1)).toBe(4)
		expect(nextAttemptDelaySeconds(10, 1)).toBe(MAX_ATTEMPT_DELAY_SECONDS)
		expect(nextAttemptDelaySeconds(3, 0)).toBe(0)
	})

	it("tells the device how long it still has to wait", () => {
		const lastFailedAt = new Date(NOW.getTime() - 1500)
		expect(remainingDelaySeconds(lastFailedAt, 4, NOW)).toBe(3)
		expect(remainingDelaySeconds(lastFailedAt, 1, NOW)).toBe(0)
		expect(remainingDelaySeconds(undefined, 4, NOW)).toBe(0)
	})
})
