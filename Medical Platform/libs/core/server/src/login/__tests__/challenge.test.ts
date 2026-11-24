import { describe, expect, it } from "vitest"
import { CHALLENGE_LIFETIME_SECONDS, issueChallenge } from "../challenge"
import { secondsAfter, sha256Hex } from "../secret"

const NOW = new Date("2026-09-30T10:00:00.000Z")

describe("issueChallenge", () => {
	it("issues a random value with a lifetime and keeps only its hash", () => {
		const challenge = issueChallenge(NOW)
		expect(challenge.value).not.toBe(issueChallenge(NOW).value)
		expect(challenge.valueHash).toBe(sha256Hex(challenge.value))
		expect(challenge.expiresAt).toEqual(secondsAfter(NOW, CHALLENGE_LIFETIME_SECONDS))
	})
})
